// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";

/// @notice Sealed first-price auction for fixed future PFDA windows, funded in one ERC-20.
/// @dev No hook/executor authentication in this contract. Only standard, non-rebasing ERC-20s.
///      All deadlines use chain timestamps in seconds; timing is not a source of randomness.
// This contract intentionally compares timestamps to precommitted deadlines (see docs/AUCTION.md).
// forge-lint: disable-start(block-timestamp)
contract PFDAAuction is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Schedule {
        uint64 commitStart;
        uint64 commitEnd;
        uint64 revealEnd;
        uint64 activation;
        uint64 expiry;
    }

    struct Auction {
        PoolId poolId;
        Schedule schedule;
        uint128 bond;
        uint128 minimumBid;
        uint256 commitments;
        uint256 reveals;
        address winner;
        uint128 winningBid;
        uint256 winningOrder;
        bool finalized;
        bool cancelled;
    }

    struct Bid {
        bytes32 commitment;
        uint256 order;
        uint128 amount;
        bool revealed;
        bool withdrawn;
    }

    enum Phase {
        Scheduled,
        Commit,
        Reveal,
        AwaitingFinalization,
        PendingActivation,
        Active,
        Expired,
        Cancelled
    }

    IERC20 public immutable bidToken;
    address public immutable deployer;
    uint64 public immutable minimumActivationDelay;
    uint256 public nextAuctionId = 1;
    uint256 public totalRefundable;
    uint256 public treasuryCredit;
    mapping(uint256 => Auction) private auctions;
    mapping(uint256 => mapping(address => Bid)) public bids;
    mapping(PoolId => uint64) public lastScheduledExpiry;

    error OnlyDeployer();
    error InvalidConfiguration();
    error UnknownAuction();
    error InvalidSchedule();
    error OverlappingWindow();
    error WrongPhase();
    error InvalidCommitment();
    error AlreadyCommitted();
    error InvalidReveal();
    error AlreadyFinalized();
    error NothingToWithdraw();
    error UnsupportedToken();

    event AuctionCreated(
        uint256 indexed auctionId,
        PoolId indexed poolId,
        Schedule schedule,
        uint128 bond,
        uint128 minimumBid
    );
    event BidCommitted(
        uint256 indexed auctionId, address indexed bidder, bytes32 commitment, uint256 order
    );
    event BidRevealed(uint256 indexed auctionId, address indexed bidder, uint128 amount);
    event AuctionFinalized(
        uint256 indexed auctionId,
        address indexed winner,
        uint128 winningBid,
        bool cancelled,
        uint256 forfeitedBonds
    );
    event RefundWithdrawn(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event ProceedsCollected(address indexed recipient, uint256 amount);

    constructor(IERC20 bidToken_, uint64 minimumActivationDelay_) {
        if (address(bidToken_).code.length == 0 || minimumActivationDelay_ == 0) {
            revert InvalidConfiguration();
        }
        bidToken = bidToken_;
        deployer = msg.sender;
        minimumActivationDelay = minimumActivationDelay_;
    }

    function createAuction(
        PoolId poolId,
        Schedule calldata schedule,
        uint128 bond,
        uint128 minimumBid
    ) external nonReentrant returns (uint256 id) {
        if (msg.sender != deployer) revert OnlyDeployer();
        if (bond == 0 || minimumBid == 0) revert InvalidConfiguration();
        if (
            schedule.commitStart < block.timestamp || schedule.commitEnd <= schedule.commitStart
                || schedule.revealEnd <= schedule.commitEnd
                || uint256(schedule.activation)
                    < uint256(schedule.revealEnd) + minimumActivationDelay
                || schedule.expiry <= schedule.activation
        ) revert InvalidSchedule();
        if (schedule.activation < lastScheduledExpiry[poolId]) revert OverlappingWindow();
        lastScheduledExpiry[poolId] = schedule.expiry;
        id = nextAuctionId++;
        Auction storage auction = auctions[id];
        auction.poolId = poolId;
        auction.schedule = schedule;
        auction.bond = bond;
        auction.minimumBid = minimumBid;
        emit AuctionCreated(id, poolId, schedule, bond, minimumBid);
    }

    function commitmentHash(uint256 id, address bidder, uint128 amount, bytes32 salt)
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(block.chainid, address(this), id, bidder, amount, salt));
    }

    function commit(uint256 id, bytes32 commitment) external nonReentrant {
        _commit(id, commitment);
    }

    /// @notice Uses an exact ERC-2612 permit for the commitment bond, then immediately consumes it.
    /// @dev Keeps ordinary `commit` available for smart-contract wallets and non-permit bid tokens.
    function commitWithPermit(
        uint256 id,
        bytes32 commitment,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        Auction storage auction = _auction(id);
        _tryPermit(msg.sender, auction.bond, deadline, v, r, s);
        _commit(id, commitment);
    }

    function _commit(uint256 id, bytes32 commitment) private {
        Auction storage auction = _auction(id);
        if (
            block.timestamp < auction.schedule.commitStart
                || block.timestamp >= auction.schedule.commitEnd
        ) {
            revert WrongPhase();
        }
        if (commitment == bytes32(0)) revert InvalidCommitment();
        Bid storage bid = bids[id][msg.sender];
        if (bid.order != 0) revert AlreadyCommitted();
        bid.commitment = commitment;
        bid.order = ++auction.commitments;
        totalRefundable += auction.bond;
        _deposit(auction.bond);
        emit BidCommitted(id, msg.sender, commitment, bid.order);
    }

    function reveal(uint256 id, uint128 amount, bytes32 salt) external nonReentrant {
        _reveal(id, amount, salt);
    }

    /// @notice Uses an exact ERC-2612 permit for the revealed bid, then immediately consumes it.
    /// @dev The signature owner is always msg.sender and the auction is the only permitted spender.
    function revealWithPermit(
        uint256 id,
        uint128 amount,
        bytes32 salt,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        _tryPermit(msg.sender, amount, deadline, v, r, s);
        _reveal(id, amount, salt);
    }

    function _reveal(uint256 id, uint128 amount, bytes32 salt) private {
        Auction storage auction = _auction(id);
        if (
            block.timestamp < auction.schedule.commitEnd
                || block.timestamp >= auction.schedule.revealEnd
        ) {
            revert WrongPhase();
        }
        Bid storage bid = bids[id][msg.sender];
        if (
            bid.order == 0 || bid.revealed || amount < auction.minimumBid
                || bid.commitment != commitmentHash(id, msg.sender, amount, salt)
        ) revert InvalidReveal();
        bid.revealed = true;
        bid.amount = amount;
        ++auction.reveals;
        if (
            amount > auction.winningBid
                || (amount == auction.winningBid && bid.order < auction.winningOrder)
        ) {
            auction.winner = msg.sender;
            auction.winningBid = amount;
            auction.winningOrder = bid.order;
        }
        totalRefundable += amount;
        _deposit(amount);
        emit BidRevealed(id, msg.sender, amount);
    }

    /// @notice Feature probe for clients; version one denotes the exact ERC-2612 entry points above.
    function permitAuthorizationVersion() external pure returns (uint8) {
        return 1;
    }

    /// @notice Anyone can finalize; must finalize before activation to sell the full fixed window.
    function finalize(uint256 id) external nonReentrant {
        Auction storage auction = _auction(id);
        if (auction.finalized) revert AlreadyFinalized();
        if (block.timestamp < auction.schedule.revealEnd) revert WrongPhase();
        auction.finalized = true;
        auction.cancelled = auction.reveals == 0 || block.timestamp >= auction.schedule.activation;
        uint256 forfeited = (auction.commitments - auction.reveals) * auction.bond;
        uint256 proceeds = forfeited;
        if (!auction.cancelled) proceeds += auction.winningBid;
        totalRefundable -= proceeds;
        treasuryCredit += proceeds;
        emit AuctionFinalized(id, auction.winner, auction.winningBid, auction.cancelled, forfeited);
    }

    /// @notice Revealed losers recover bond + bid; the successful winner recovers only its bond.
    ///         Cancelled auctions refund all revealed bids. Unrevealed bonds remain forfeited.
    function withdrawRefund(uint256 id) external nonReentrant {
        Auction storage auction = _auction(id);
        if (!auction.finalized) revert WrongPhase();
        Bid storage bid = bids[id][msg.sender];
        if (!bid.revealed || bid.withdrawn) revert NothingToWithdraw();
        bid.withdrawn = true;
        uint256 amount = uint256(auction.bond) + bid.amount;
        if (!auction.cancelled && auction.winner == msg.sender) amount -= auction.winningBid;
        totalRefundable -= amount;
        bidToken.safeTransfer(msg.sender, amount);
        emit RefundWithdrawn(id, msg.sender, amount);
    }

    /// @notice Permissionless trigger; funds always go to the immutable deploying wallet.
    function collectProceeds() external nonReentrant {
        uint256 amount = treasuryCredit;
        if (amount == 0) revert NothingToWithdraw();
        treasuryCredit = 0;
        bidToken.safeTransfer(deployer, amount);
        emit ProceedsCollected(deployer, amount);
    }

    function getAuction(uint256 id) external view returns (Auction memory) {
        return _auction(id);
    }

    /// @notice Returns the winning bidder, not an authenticated executor; chunk 3 bridges that gap.
    function activeWinner(uint256 id) external view returns (address) {
        Auction storage auction = _auction(id);
        if (
            !auction.finalized || auction.cancelled || block.timestamp < auction.schedule.activation
                || block.timestamp >= auction.schedule.expiry
        ) return address(0);
        return auction.winner;
    }

    function phase(uint256 id) external view returns (Phase) {
        Auction storage auction = _auction(id);
        if (auction.cancelled) return Phase.Cancelled;
        if (block.timestamp < auction.schedule.commitStart) return Phase.Scheduled;
        if (block.timestamp < auction.schedule.commitEnd) return Phase.Commit;
        if (block.timestamp < auction.schedule.revealEnd) return Phase.Reveal;
        if (!auction.finalized) return Phase.AwaitingFinalization;
        if (block.timestamp < auction.schedule.activation) return Phase.PendingActivation;
        if (block.timestamp < auction.schedule.expiry) return Phase.Active;
        return Phase.Expired;
    }

    function _auction(uint256 id) private view returns (Auction storage auction) {
        auction = auctions[id];
        if (id == 0 || id >= nextAuctionId) revert UnknownAuction();
    }

    function _deposit(uint256 amount) private {
        uint256 beforeBalance = bidToken.balanceOf(address(this));
        bidToken.safeTransferFrom(msg.sender, address(this), amount);
        if (bidToken.balanceOf(address(this)) != beforeBalance + amount) revert UnsupportedToken();
    }

    /// @dev A permit can be submitted separately before this transaction. In that case, use the
    ///      already-set exact allowance; otherwise `_deposit` safely rejects the action.
    function _tryPermit(
        address owner,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) private {
        try IERC20Permit(address(bidToken))
            .permit(owner, address(this), value, deadline, v, r, s) {}
            catch {}
    }
}
// forge-lint: disable-end(block-timestamp)
