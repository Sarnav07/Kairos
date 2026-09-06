// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {PFDAAuction} from "../src/PFDAAuction.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";

contract AuctionHandler is Test {
    PFDAAuction public immutable auction;
    MockUSDC public immutable token;
    address[4] public actors;
    uint128[4] public amounts;
    uint256[4] public orders;
    bool[4] public revealed;
    uint256 public successfulCommits;
    uint256 public successfulReveals;
    bytes32 private constant SALT = keccak256("invariant fixture only");

    constructor(PFDAAuction auction_, MockUSDC token_) {
        auction = auction_;
        token = token_;
        for (uint256 i; i < 4; ++i) {
            // i < 4, so the fixture address integer is at most 103.
            // forge-lint: disable-next-line(unsafe-typecast)
            actors[i] = address(uint160(100 + i));
            token.mint(actors[i], 1000e6);
            vm.prank(actors[i]);
            token.approve(address(auction), type(uint256).max);
        }
    }

    function advance(uint8 secondsForward) external {
        vm.warp(block.timestamp + bound(secondsForward, 1, 30));
    }

    function commit(uint8 index, uint128 rawAmount) external {
        uint256 i = index % 4;
        uint128 amount = uint128(bound(rawAmount, 1e6, 900e6));
        bytes32 hash = auction.commitmentHash(1, actors[i], amount, SALT);
        vm.prank(actors[i]);
        try auction.commit(1, hash) {
            amounts[i] = amount;
            orders[i] = ++successfulCommits;
        } catch {}
    }

    function reveal(uint8 index) external {
        uint256 i = index % 4;
        vm.prank(actors[i]);
        try auction.reveal(1, amounts[i], SALT) {
            revealed[i] = true;
            ++successfulReveals;
        } catch {}
    }

    function finalize() external {
        try auction.finalize(1) {} catch {}
    }

    function refund(uint8 index) external {
        vm.prank(actors[index % 4]);
        try auction.withdrawRefund(1) {} catch {}
    }

    function collect() external {
        try auction.collectProceeds() {} catch {}
    }
}

contract PFDAAuctionInvariantTest is StdInvariant, Test {
    PFDAAuction internal auction;
    MockUSDC internal token;
    AuctionHandler internal handler;

    function setUp() public {
        vm.warp(1000);
        token = new MockUSDC();
        auction = new PFDAAuction(token, 60);
        auction.createAuction(
            PoolId.wrap(bytes32(uint256(1))),
            PFDAAuction.Schedule(1000, 1050, 1100, 1160, 1260),
            10e6,
            1e6
        );
        handler = new AuctionHandler(auction, token);
        // Seed one funded commitment so every run exercises at least one escrow liability.
        handler.commit(0, 100e6);
        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = handler.advance.selector;
        selectors[1] = handler.commit.selector;
        selectors[2] = handler.reveal.selector;
        selectors[3] = handler.finalize.selector;
        selectors[4] = handler.refund.selector;
        selectors[5] = handler.collect.selector;
        targetSelector(FuzzSelector(address(handler), selectors));
        targetContract(address(handler));
    }

    function invariantEscrowCoversExactlyAllLiabilities() public view {
        assertEq(
            token.balanceOf(address(auction)), auction.totalRefundable() + auction.treasuryCredit()
        );
    }

    function invariantTokensAreConservedAcrossAllParticipants() public view {
        uint256 total = token.balanceOf(address(auction)) + token.balanceOf(address(this));
        for (uint256 i; i < 4; ++i) {
            total += token.balanceOf(handler.actors(i));
        }
        assertEq(total, 4000e6);
        assertEq(token.totalSupply(), 4000e6);
    }

    function invariantHighestRevealedBidAndCommitCountsMatchIndependentModel() public view {
        PFDAAuction.Auction memory state = auction.getAuction(1);
        uint256 winningAmount;
        uint256 winningOrder = type(uint256).max;
        address winner;
        for (uint256 i; i < 4; ++i) {
            if (!handler.revealed(i)) continue;
            uint256 amount = handler.amounts(i);
            uint256 order = handler.orders(i);
            if (amount > winningAmount || (amount == winningAmount && order < winningOrder)) {
                winningAmount = amount;
                winningOrder = order;
                winner = handler.actors(i);
            }
        }
        assertEq(state.winner, winner);
        assertEq(state.winningBid, winningAmount);
        assertEq(state.commitments, handler.successfulCommits());
        assertEq(state.reveals, handler.successfulReveals());
    }

    function afterInvariant() public {
        // Advance test time to settlement, never backwards.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < 1100) vm.warp(1100);
        if (!auction.getAuction(1).finalized) auction.finalize(1);
        PFDAAuction.Auction memory state = auction.getAuction(1);
        uint256 expectedTreasury;
        for (uint256 i; i < 4; ++i) {
            address user = handler.actors(i);
            vm.prank(user);
            try auction.withdrawRefund(1) {} catch {}
            uint256 cost;
            if (handler.orders(i) > 0 && !handler.revealed(i)) cost = 10e6;
            if (!state.cancelled && user == state.winner) cost = handler.amounts(i);
            assertEq(token.balanceOf(user), 1000e6 - cost, "incorrect final bidder entitlement");
            expectedTreasury += cost;
        }
        if (auction.treasuryCredit() > 0) auction.collectProceeds();
        assertEq(token.balanceOf(address(this)), expectedTreasury);
        assertEq(token.balanceOf(address(auction)), 0, "funds stranded after all claims");
        assertEq(auction.totalRefundable(), 0);
    }
}
