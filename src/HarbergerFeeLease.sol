// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";
import {PFDAAuction} from "./PFDAAuction.sol";
import {IFeeRightSource} from "./interfaces/IFeeRightSource.sol";

/// @notice Self-assessed, prepaid lease for one pool's application-surcharge waiver.
/// @dev The initial holder is the active winner of one immutable sealed auction. All amounts are
///      token atomic units. Rent and creditor withdrawals are pull-based.
// forge-lint: disable-start(block-timestamp)
contract HarbergerFeeLease is IFeeRightSource, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BASIS_POINTS = 10_000;
    uint256 public constant YEAR = 365 days;
    uint16 public constant MAX_RENT_RATE_BPS = 10_000;

    struct Lease {
        address holder;
        uint128 valuation;
        uint128 collateral;
        uint64 lastSettled;
        uint64 insolventAt;
        uint256 rentRemainder;
        uint256 arrears;
    }

    IERC20 public immutable bidToken;
    PFDAAuction public immutable initialAuction;
    uint256 public immutable initialAuctionId;
    PoolId public immutable poolId;
    address public immutable recipient;
    uint16 public immutable rentRateBps;
    uint128 public immutable minimumValuation;
    uint64 public immutable settlementInterval;
    uint64 public immutable gracePeriod;

    Lease public lease;
    bool public initialClaimed;
    uint256 public totalCollateral;
    uint256 public rentCredit;
    uint256 public totalWithdrawableCredits;
    mapping(address => uint256) public refundCredit;
    mapping(address => uint256) public takeoverCredit;

    error InvalidConfiguration();
    error WrongPool();
    error InitialHolderOnly();
    error InitialAlreadyClaimed();
    error NotVacant();
    error NotHolder();
    error NotActive();
    error NotInsolvent();
    error GraceExpired();
    error GraceNotExpired();
    error InvalidValuation();
    error InsufficientPrepayment();
    error UnsupportedToken();
    error NothingToWithdraw();

    event InitialClaimed(address indexed holder, uint256 valuation, uint256 collateral);
    event VacantRightClaimed(address indexed holder, uint256 valuation, uint256 collateral);
    event RentSettled(uint256 due, uint256 paid, uint256 arrears, uint256 insolventAt);
    event CollateralToppedUp(address indexed holder, uint256 amount);
    event LeaseCured(address indexed holder, uint256 paidArrears, uint256 collateral);
    event ValuationSet(address indexed holder, uint256 valuation, uint256 collateral);
    event LeaseReleased(address indexed holder, uint256 refund);
    event LeaseTakenOver(
        address indexed incumbent,
        address indexed challenger,
        uint256 price,
        uint256 newValuation,
        uint256 newCollateral
    );
    event LeaseLiquidated(address indexed formerHolder, uint256 arrears);
    event RentCollected(address indexed recipient, uint256 amount);
    event CreditWithdrawn(address indexed account, uint256 refund, uint256 takeover);

    constructor(
        PFDAAuction initialAuction_,
        uint256 initialAuctionId_,
        PoolId poolId_,
        uint16 rentRateBps_,
        uint128 minimumValuation_,
        uint64 settlementInterval_,
        uint64 gracePeriod_
    ) {
        if (
            address(initialAuction_).code.length == 0 || rentRateBps_ == 0
                || rentRateBps_ > MAX_RENT_RATE_BPS || minimumValuation_ == 0
                || settlementInterval_ == 0 || gracePeriod_ == 0
        ) revert InvalidConfiguration();
        PFDAAuction.Auction memory auctionData = initialAuction_.getAuction(initialAuctionId_);
        if (PoolId.unwrap(auctionData.poolId) != PoolId.unwrap(poolId_)) {
            revert InvalidConfiguration();
        }

        bidToken = initialAuction_.bidToken();
        initialAuction = initialAuction_;
        initialAuctionId = initialAuctionId_;
        poolId = poolId_;
        recipient = initialAuction_.deployer();
        rentRateBps = rentRateBps_;
        minimumValuation = minimumValuation_;
        settlementInterval = settlementInterval_;
        gracePeriod = gracePeriod_;

        if (_minimumPrepay(minimumValuation_) == 0) revert InvalidConfiguration();
    }

    /// @notice Claims the lease only for the active winner of the immutable initial auction.
    function claimInitial(uint128 valuation, uint128 deposit) external nonReentrant {
        if (initialClaimed) revert InitialAlreadyClaimed();
        if (initialAuction.activeWinner(initialAuctionId) != msg.sender) {
            revert InitialHolderOnly();
        }
        _validateEntry(valuation, deposit);
        _receive(msg.sender, deposit);
        initialClaimed = true;
        _open(msg.sender, valuation, deposit);
        emit InitialClaimed(msg.sender, valuation, deposit);
    }

    /// @notice Claims an already-vacant right after the initial auction holder has exited or defaulted.
    function claimVacant(uint128 valuation, uint128 deposit) external nonReentrant {
        if (!initialClaimed || lease.holder != address(0)) revert NotVacant();
        _validateEntry(valuation, deposit);
        _receive(msg.sender, deposit);
        _open(msg.sender, valuation, deposit);
        emit VacantRightClaimed(msg.sender, valuation, deposit);
    }

    function settle() external nonReentrant {
        _settle();
    }

    function topUp(uint128 amount) external nonReentrant {
        if (lease.holder != msg.sender) revert NotHolder();
        _settle();
        if (!_isActive()) revert NotActive();
        _receive(msg.sender, amount);
        lease.collateral += amount;
        totalCollateral += amount;
        emit CollateralToppedUp(msg.sender, amount);
    }

    function cure(uint128 amount) external nonReentrant {
        if (lease.holder != msg.sender) revert NotHolder();
        _settle();
        if (lease.arrears == 0) revert NotInsolvent();
        if (block.timestamp > uint256(lease.insolventAt) + gracePeriod) revert GraceExpired();
        uint256 required = lease.arrears + _minimumPrepay(lease.valuation);
        if (amount < required) revert InsufficientPrepayment();
        _receive(msg.sender, amount);
        uint256 arrears = lease.arrears;
        rentCredit += arrears;
        lease.arrears = 0;
        lease.insolventAt = 0;
        uint256 collateral = amount - arrears;
        // `collateral <= amount`, and `amount` is uint128 at the entrypoint.
        // forge-lint: disable-next-line(unsafe-typecast)
        lease.collateral = uint128(collateral);
        totalCollateral += collateral;
        emit LeaseCured(msg.sender, arrears, collateral);
    }

    function setValuation(uint128 valuation, uint128 additionalDeposit) external nonReentrant {
        if (lease.holder != msg.sender) revert NotHolder();
        _settle();
        if (!_isActive()) revert NotActive();
        if (valuation < minimumValuation) revert InvalidValuation();
        if (additionalDeposit != 0) {
            _receive(msg.sender, additionalDeposit);
            lease.collateral += additionalDeposit;
            totalCollateral += additionalDeposit;
        }
        if (lease.collateral < _minimumPrepay(valuation)) revert InsufficientPrepayment();
        lease.valuation = valuation;
        emit ValuationSet(msg.sender, valuation, lease.collateral);
    }

    function release() external nonReentrant {
        if (lease.holder != msg.sender) revert NotHolder();
        _settle();
        address holder = lease.holder;
        uint256 refund = lease.collateral;
        _clearHolder();
        if (refund != 0) _creditRefund(holder, refund);
        emit LeaseReleased(holder, refund);
    }

    function takeOver(uint128 newValuation, uint128 newDeposit) external nonReentrant {
        if (lease.holder == address(0)) revert NotVacant();
        _settle();
        if (!_isActive()) revert NotActive();
        _validateEntry(newValuation, newDeposit);

        address incumbent = lease.holder;
        uint256 price = lease.valuation;
        uint256 refund = lease.collateral;
        _receive(msg.sender, price + newDeposit);
        _clearHolder();
        _creditTakeover(incumbent, price);
        if (refund != 0) _creditRefund(incumbent, refund);
        _open(msg.sender, newValuation, newDeposit);
        emit LeaseTakenOver(incumbent, msg.sender, price, newValuation, newDeposit);
    }

    function liquidate() external nonReentrant {
        if (lease.holder == address(0)) revert NotVacant();
        _settle();
        if (lease.arrears == 0) revert NotInsolvent();
        if (block.timestamp <= uint256(lease.insolventAt) + gracePeriod) revert GraceNotExpired();
        address formerHolder = lease.holder;
        uint256 arrears = lease.arrears;
        _clearHolder();
        emit LeaseLiquidated(formerHolder, arrears);
    }

    function collectRent() external nonReentrant {
        uint256 amount = rentCredit;
        if (amount == 0) revert NothingToWithdraw();
        rentCredit = 0;
        bidToken.safeTransfer(recipient, amount);
        emit RentCollected(recipient, amount);
    }

    function withdrawCredits() external nonReentrant {
        uint256 refund = refundCredit[msg.sender];
        uint256 takeover = takeoverCredit[msg.sender];
        uint256 amount = refund + takeover;
        if (amount == 0) revert NothingToWithdraw();
        refundCredit[msg.sender] = 0;
        takeoverCredit[msg.sender] = 0;
        totalWithdrawableCredits -= amount;
        bidToken.safeTransfer(msg.sender, amount);
        emit CreditWithdrawn(msg.sender, refund, takeover);
    }

    function activeHolder(PoolId queryPoolId) external view returns (address) {
        if (PoolId.unwrap(queryPoolId) != PoolId.unwrap(poolId) || !_isActive()) return address(0);
        return lease.holder;
    }

    function currentRentDue() external view returns (uint256 due, uint256 remainder) {
        return _accrued();
    }

    /// @notice Returns the complete lease record for dashboards and solvency monitors.
    function leaseState() external view returns (Lease memory) {
        return lease;
    }

    function solvencyUntil() public view returns (uint256) {
        if (lease.holder == address(0) || lease.valuation == 0) return 0;
        uint256 numeratorPerSecond = uint256(lease.valuation) * rentRateBps;
        uint256 denominator = BASIS_POINTS * YEAR;
        uint256 upperExclusive = (uint256(lease.collateral) + 1) * denominator;
        uint256 maxElapsed = (upperExclusive - 1 - lease.rentRemainder) / numeratorPerSecond;
        return uint256(lease.lastSettled) + maxElapsed;
    }

    function accountedBalance() external view returns (uint256) {
        return totalCollateral + rentCredit + totalWithdrawableCredits;
    }

    function minimumPrepay(uint128 valuation) external view returns (uint256) {
        return _minimumPrepay(valuation);
    }

    function _open(address holder, uint128 valuation, uint128 collateral) private {
        lease = Lease({
            holder: holder,
            valuation: valuation,
            collateral: collateral,
            lastSettled: uint64(block.timestamp),
            insolventAt: 0,
            rentRemainder: 0,
            arrears: 0
        });
        totalCollateral += collateral;
    }

    function _clearHolder() private {
        totalCollateral -= lease.collateral;
        delete lease;
    }

    function _settle() private {
        if (lease.holder == address(0)) return;
        uint256 until = solvencyUntil();
        (uint256 due, uint256 remainder) = _accrued();
        lease.lastSettled = uint64(block.timestamp);
        lease.rentRemainder = remainder;
        uint256 paid = due > lease.collateral ? lease.collateral : due;
        if (paid != 0) {
            // `paid <= lease.collateral`, whose storage type is uint128.
            // forge-lint: disable-next-line(unsafe-typecast)
            lease.collateral -= uint128(paid);
            totalCollateral -= paid;
            rentCredit += paid;
        }
        if (due > paid) {
            lease.arrears += due - paid;
            if (lease.insolventAt == 0) {
                // The EVM timestamp is represented as uint64 in the lease record.
                // forge-lint: disable-next-line(unsafe-typecast)
                lease.insolventAt = uint64(until);
            }
        }
        emit RentSettled(due, paid, lease.arrears, lease.insolventAt);
    }

    function _accrued() private view returns (uint256 due, uint256 remainder) {
        if (lease.holder == address(0)) return (0, 0);
        uint256 elapsed = block.timestamp - lease.lastSettled;
        uint256 numerator = uint256(lease.valuation) * rentRateBps * elapsed + lease.rentRemainder;
        uint256 denominator = BASIS_POINTS * YEAR;
        return (numerator / denominator, numerator % denominator);
    }

    function _isActive() private view returns (bool) {
        return
            lease.holder != address(0) && lease.arrears == 0 && block.timestamp <= solvencyUntil();
    }

    function _minimumPrepay(uint128 valuation) private view returns (uint256) {
        uint256 denominator = BASIS_POINTS * YEAR;
        uint256 numerator = uint256(valuation) * rentRateBps * settlementInterval;
        return (numerator + denominator - 1) / denominator;
    }

    function _validateEntry(uint128 valuation, uint128 deposit) private view {
        if (valuation < minimumValuation) revert InvalidValuation();
        if (deposit < _minimumPrepay(valuation)) revert InsufficientPrepayment();
    }

    function _receive(address from, uint256 amount) private {
        uint256 beforeBalance = bidToken.balanceOf(address(this));
        bidToken.safeTransferFrom(from, address(this), amount);
        if (bidToken.balanceOf(address(this)) != beforeBalance + amount) revert UnsupportedToken();
    }

    function _creditRefund(address account, uint256 amount) private {
        refundCredit[account] += amount;
        totalWithdrawableCredits += amount;
    }

    function _creditTakeover(address account, uint256 amount) private {
        takeoverCredit[account] += amount;
        totalWithdrawableCredits += amount;
    }
}
// forge-lint: disable-end(block-timestamp)
