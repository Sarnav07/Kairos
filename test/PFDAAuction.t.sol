// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PFDAAuction} from "../src/PFDAAuction.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";

contract PFDAAuctionTest is Test {
    PFDAAuction internal auction;
    MockUSDC internal token;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA401);
    PoolId internal pool = PoolId.wrap(bytes32(uint256(1)));
    uint128 internal constant BOND = 10e6;
    uint128 internal constant MIN_BID = 1e6;
    bytes32 internal constant SALT =
        keccak256("deterministic test salt; never reuse in production");
    uint256 internal id;

    function setUp() public {
        vm.warp(1000);
        token = new MockUSDC();
        auction = new PFDAAuction(token, 60);
        id = auction.createAuction(pool, _schedule(), BOND, MIN_BID);
        _fund(alice);
        _fund(bob);
        _fund(carol);
    }

    function _schedule() internal pure returns (PFDAAuction.Schedule memory) {
        return PFDAAuction.Schedule(1010, 1110, 1210, 1270, 1370);
    }

    function _fund(address user) internal {
        token.mint(user, 1000e6);
        vm.prank(user);
        token.approve(address(auction), type(uint256).max);
    }

    function _commit(address user, uint128 amount) internal {
        bytes32 hash =
            keccak256(abi.encode(block.chainid, address(auction), id, user, amount, SALT));
        vm.prank(user);
        auction.commit(id, hash);
    }

    function _reveal(address user, uint128 amount) internal {
        vm.prank(user);
        auction.reveal(id, amount, SALT);
    }

    function _ready() internal {
        vm.warp(1010);
        _commit(alice, 100e6);
        _commit(bob, 150e6);
        _commit(carol, 200e6);
        vm.warp(1110);
        _reveal(alice, 100e6);
        _reveal(bob, 150e6);
        vm.warp(1210);
    }

    function _refund(address user) internal {
        vm.prank(user);
        auction.withdrawRefund(id);
    }

    function testLifecycleFirstPriceRefundsForfeitureAndDeployerProceeds() public {
        _ready();
        vm.prank(carol);
        auction.finalize(id);
        PFDAAuction.Auction memory result = auction.getAuction(id);
        assertEq(result.winner, bob);
        assertEq(result.winningBid, 150e6);
        assertFalse(result.cancelled);
        assertEq(auction.treasuryCredit(), 160e6);
        assertEq(auction.totalRefundable(), 120e6);
        assertEq(auction.activeWinner(id), address(0));
        _refund(alice);
        _refund(bob);
        vm.expectRevert(PFDAAuction.NothingToWithdraw.selector);
        _refund(carol);
        vm.prank(carol);
        auction.collectProceeds();
        assertEq(auction.deployer(), address(this));
        assertEq(token.balanceOf(address(this)), 160e6);
        assertEq(token.balanceOf(alice), 1000e6);
        assertEq(token.balanceOf(bob), 850e6);
        assertEq(token.balanceOf(carol), 990e6);
        assertEq(token.balanceOf(address(auction)), 0);
        assertEq(auction.totalRefundable(), 0);
        assertEq(auction.treasuryCredit(), 0);
        vm.warp(1270);
        assertEq(auction.activeWinner(id), bob);
        vm.warp(1369);
        assertEq(auction.activeWinner(id), bob);
        vm.warp(1370);
        assertEq(auction.activeWinner(id), address(0));
    }

    function testTieUsesCommitOrderNotRevealOrder() public {
        vm.warp(1010);
        _commit(alice, 100e6);
        _commit(bob, 100e6);
        vm.warp(1110);
        _reveal(bob, 100e6);
        _reveal(alice, 100e6);
        vm.warp(1210);
        auction.finalize(id);
        assertEq(auction.getAuction(id).winner, alice);
    }

    function testFuzzFirstPriceAndSolvency(uint128 a, uint128 b, bool reverseReveals) public {
        a = uint128(bound(a, MIN_BID, 900e6));
        b = uint128(bound(b, MIN_BID, 900e6));
        vm.warp(1010);
        _commit(alice, a);
        _commit(bob, b);
        vm.warp(1110);
        if (reverseReveals) {
            _reveal(bob, b);
            _reveal(alice, a);
        } else {
            _reveal(alice, a);
            _reveal(bob, b);
        }
        vm.warp(1210);
        auction.finalize(id);
        address winner = a >= b ? alice : bob;
        uint256 price = a >= b ? a : b;
        assertEq(auction.getAuction(id).winner, winner);
        assertEq(auction.treasuryCredit(), price);
        assertEq(
            token.balanceOf(address(auction)), auction.totalRefundable() + auction.treasuryCredit()
        );
        auction.collectProceeds();
        _refund(bob);
        _refund(alice);
        assertEq(token.balanceOf(address(auction)), 0);
        assertEq(token.balanceOf(alice), 1000e6 - (winner == alice ? price : 0));
        assertEq(token.balanceOf(bob), 1000e6 - (winner == bob ? price : 0));
    }

    function testLateFinalizationAtActivationCancelsWithoutSellingShorterWindow() public {
        _ready();
        vm.warp(1270);
        auction.finalize(id);
        assertTrue(auction.getAuction(id).cancelled);
        assertEq(auction.treasuryCredit(), BOND);
        assertEq(auction.activeWinner(id), address(0));
        _refund(alice);
        _refund(bob);
        auction.collectProceeds();
        assertEq(token.balanceOf(alice), 1000e6);
        assertEq(token.balanceOf(bob), 1000e6);
        assertEq(token.balanceOf(address(auction)), 0);
    }

    function testFinalizationAfterExpiryCancelsAndRefunds() public {
        _ready();
        vm.warp(2000);
        auction.finalize(id);
        assertTrue(auction.getAuction(id).cancelled);
        _refund(alice);
        _refund(bob);
        assertEq(token.balanceOf(alice), 1000e6);
        assertEq(auction.activeWinner(id), address(0));
    }

    function testNoBidsCancels() public {
        vm.warp(1210);
        auction.finalize(id);
        assertTrue(auction.getAuction(id).cancelled);
        assertEq(auction.treasuryCredit(), 0);
    }

    function testNoRevealsForfeitsOnlyBonds() public {
        vm.warp(1010);
        _commit(alice, 100e6);
        _commit(bob, 150e6);
        vm.warp(1210);
        auction.finalize(id);
        assertTrue(auction.getAuction(id).cancelled);
        assertEq(auction.totalRefundable(), 0);
        assertEq(auction.treasuryCredit(), 2 * BOND);
        auction.collectProceeds();
        assertEq(token.balanceOf(address(auction)), 0);
    }

    function testPhaseBoundaries() public {
        assertEq(uint256(auction.phase(id)), uint256(PFDAAuction.Phase.Scheduled));
        vm.expectRevert(PFDAAuction.WrongPhase.selector);
        _commit(alice, 100e6);
        vm.warp(1010);
        _commit(alice, 100e6);
        assertEq(uint256(auction.phase(id)), uint256(PFDAAuction.Phase.Commit));
        vm.warp(1109);
        vm.expectRevert(PFDAAuction.WrongPhase.selector);
        _reveal(alice, 100e6);
        vm.warp(1110);
        assertEq(uint256(auction.phase(id)), uint256(PFDAAuction.Phase.Reveal));
        vm.expectRevert(PFDAAuction.WrongPhase.selector);
        _commit(bob, 100e6);
        _reveal(alice, 100e6);
        vm.warp(1209);
        vm.expectRevert(PFDAAuction.WrongPhase.selector);
        auction.finalize(id);
        vm.warp(1210);
        vm.expectRevert(PFDAAuction.WrongPhase.selector);
        _reveal(alice, 100e6);
        assertEq(uint256(auction.phase(id)), uint256(PFDAAuction.Phase.AwaitingFinalization));
        auction.finalize(id);
        assertEq(uint256(auction.phase(id)), uint256(PFDAAuction.Phase.PendingActivation));
        vm.warp(1270);
        assertEq(uint256(auction.phase(id)), uint256(PFDAAuction.Phase.Active));
        vm.warp(1370);
        assertEq(uint256(auction.phase(id)), uint256(PFDAAuction.Phase.Expired));
    }

    function testInvalidAndRepeatedReveal() public {
        vm.warp(1010);
        _commit(alice, 100e6);
        vm.warp(1110);
        vm.expectRevert(PFDAAuction.InvalidReveal.selector);
        _reveal(bob, 100e6);
        vm.expectRevert(PFDAAuction.InvalidReveal.selector);
        _reveal(alice, 101e6);
        vm.prank(alice);
        vm.expectRevert(PFDAAuction.InvalidReveal.selector);
        auction.reveal(id, 100e6, bytes32(0));
        _reveal(alice, 100e6);
        vm.expectRevert(PFDAAuction.InvalidReveal.selector);
        _reveal(alice, 100e6);
    }

    function testBelowReserveRevealRejected() public {
        vm.warp(1010);
        _commit(alice, 1);
        vm.warp(1110);
        vm.expectRevert(PFDAAuction.InvalidReveal.selector);
        _reveal(alice, 1);
    }

    function testDuplicateAndEmptyCommitRejected() public {
        vm.warp(1010);
        vm.prank(alice);
        vm.expectRevert(PFDAAuction.InvalidCommitment.selector);
        auction.commit(id, bytes32(0));
        _commit(alice, 100e6);
        vm.expectRevert(PFDAAuction.AlreadyCommitted.selector);
        _commit(alice, 200e6);
        assertEq(token.balanceOf(alice), 1000e6 - BOND);
    }

    function testCommitmentBindsBidderAuctionContractAndChain() public {
        bytes32 original = auction.commitmentHash(id, alice, 100e6, SALT);
        assertNotEq(original, auction.commitmentHash(id, bob, 100e6, SALT));
        assertNotEq(original, auction.commitmentHash(id + 1, alice, 100e6, SALT));
        PFDAAuction other = new PFDAAuction(token, 60);
        assertNotEq(original, other.commitmentHash(id, alice, 100e6, SALT));
        vm.chainId(block.chainid + 1);
        assertNotEq(original, auction.commitmentHash(id, alice, 100e6, SALT));
    }

    function testCopiedCommitmentCannotRevealAsDifferentBidder() public {
        vm.warp(1010);
        bytes32 copied = auction.commitmentHash(id, alice, 100e6, SALT);
        vm.prank(bob);
        auction.commit(id, copied);
        vm.warp(1110);
        vm.expectRevert(PFDAAuction.InvalidReveal.selector);
        _reveal(bob, 100e6);
    }

    function testNoDoubleFinalizeRefundOrProceeds() public {
        _ready();
        vm.expectRevert(PFDAAuction.WrongPhase.selector);
        _refund(alice);
        auction.finalize(id);
        vm.expectRevert(PFDAAuction.AlreadyFinalized.selector);
        auction.finalize(id);
        _refund(alice);
        vm.expectRevert(PFDAAuction.NothingToWithdraw.selector);
        _refund(alice);
        auction.collectProceeds();
        vm.expectRevert(PFDAAuction.NothingToWithdraw.selector);
        auction.collectProceeds();
    }

    function testInsufficientCommitAllowanceRollsBack() public {
        vm.prank(alice);
        token.approve(address(auction), 0);
        vm.warp(1010);
        vm.expectRevert();
        _commit(alice, 100e6);
        assertEq(auction.getAuction(id).commitments, 0);
        assertEq(auction.totalRefundable(), 0);
    }

    function testUnfundedRevealRollsBackAndCanRetry() public {
        vm.warp(1010);
        _commit(alice, 100e6);
        vm.prank(alice);
        token.approve(address(auction), 0);
        vm.warp(1110);
        vm.expectRevert();
        _reveal(alice, 100e6);
        assertEq(auction.getAuction(id).reveals, 0);
        assertEq(auction.getAuction(id).winner, address(0));
        assertEq(auction.totalRefundable(), BOND);
        vm.prank(alice);
        token.approve(address(auction), 100e6);
        _reveal(alice, 100e6);
        assertEq(auction.getAuction(id).reveals, 1);
    }

    function testPermitCommitAndRevealConsumeExactAuthorizations() public {
        uint256 signerKey = 0xD1CE;
        address bidder = vm.addr(signerKey);
        uint128 amount = 125e6;
        uint256 deadline = block.timestamp + 15 minutes;
        token.mint(bidder, 1_000e6);

        vm.warp(1010);
        bytes32 commitment = auction.commitmentHash(id, bidder, amount, SALT);
        (uint8 commitV, bytes32 commitR, bytes32 commitS) =
            _permitSignature(signerKey, bidder, BOND, deadline);
        vm.prank(bidder);
        auction.commitWithPermit(id, commitment, deadline, commitV, commitR, commitS);
        assertEq(token.allowance(bidder, address(auction)), 0);
        assertEq(token.nonces(bidder), 1);

        vm.warp(1110);
        (uint8 revealV, bytes32 revealR, bytes32 revealS) =
            _permitSignature(signerKey, bidder, amount, deadline);
        vm.prank(bidder);
        auction.revealWithPermit(id, amount, SALT, deadline, revealV, revealR, revealS);
        assertEq(token.allowance(bidder, address(auction)), 0);
        assertEq(token.nonces(bidder), 2);
        assertEq(auction.getAuction(id).reveals, 1);
        assertEq(auction.permitAuthorizationVersion(), 1);
    }

    function testPermitEntrypointsRejectExpiredAndToleratePreSubmittedPermit() public {
        uint256 signerKey = 0xD1CE;
        address bidder = vm.addr(signerKey);
        uint128 amount = 125e6;
        uint256 deadline = 1009;
        token.mint(bidder, 1_000e6);
        bytes32 commitment = auction.commitmentHash(id, bidder, amount, SALT);
        (uint8 v, bytes32 r, bytes32 s) = _permitSignature(signerKey, bidder, BOND, deadline);

        vm.warp(1010);
        vm.prank(bidder);
        vm.expectRevert();
        auction.commitWithPermit(id, commitment, deadline, v, r, s);
        assertEq(auction.getAuction(id).commitments, 0);

        deadline = block.timestamp + 15 minutes;
        (v, r, s) = _permitSignature(signerKey, bidder, BOND, deadline);
        token.permit(bidder, address(auction), BOND, deadline, v, r, s);
        assertEq(token.allowance(bidder, address(auction)), BOND);
        vm.prank(bidder);
        auction.commitWithPermit(id, commitment, deadline, v, r, s);
        assertEq(token.nonces(bidder), 1);
        assertEq(token.allowance(bidder, address(auction)), 0);
        assertEq(auction.getAuction(id).commitments, 1);
    }

    function testSchedulePermissionsAndNonOverlap() public {
        PFDAAuction.Schedule memory schedule = _schedule();
        vm.prank(alice);
        vm.expectRevert(PFDAAuction.OnlyDeployer.selector);
        auction.createAuction(pool, schedule, BOND, MIN_BID);
        vm.expectRevert(PFDAAuction.OverlappingWindow.selector);
        auction.createAuction(pool, schedule, BOND, MIN_BID);
        schedule.activation = 1370;
        schedule.expiry = 1470;
        uint256 next = auction.createAuction(pool, schedule, BOND, MIN_BID);
        assertEq(next, 2);
    }

    function testInvalidScheduleAndZeroAmounts() public {
        PFDAAuction.Schedule memory schedule = _schedule();
        vm.expectRevert(PFDAAuction.InvalidConfiguration.selector);
        auction.createAuction(pool, schedule, 0, MIN_BID);
        vm.expectRevert(PFDAAuction.InvalidConfiguration.selector);
        auction.createAuction(pool, schedule, BOND, 0);
        schedule.activation = 1269;
        vm.expectRevert(PFDAAuction.InvalidSchedule.selector);
        auction.createAuction(pool, schedule, BOND, MIN_BID);
        schedule = _schedule();
        schedule.commitStart = 999;
        vm.expectRevert(PFDAAuction.InvalidSchedule.selector);
        auction.createAuction(pool, schedule, BOND, MIN_BID);
    }

    function testUnknownAuctionRejected() public {
        vm.expectRevert(PFDAAuction.UnknownAuction.selector);
        auction.getAuction(0);
        vm.expectRevert(PFDAAuction.UnknownAuction.selector);
        auction.activeWinner(2);
        vm.expectRevert(PFDAAuction.UnknownAuction.selector);
        auction.finalize(2);
    }

    function testInvalidConstructorRejected() public {
        vm.expectRevert(PFDAAuction.InvalidConfiguration.selector);
        new PFDAAuction(IERC20(address(0)), 60);
        vm.expectRevert(PFDAAuction.InvalidConfiguration.selector);
        new PFDAAuction(token, 0);
    }

    function testConcurrentAuctionsHaveIndependentRefunds() public {
        uint256 other =
            auction.createAuction(PoolId.wrap(bytes32(uint256(2))), _schedule(), BOND, MIN_BID);
        vm.warp(1010);
        _commit(alice, 100e6);
        bytes32 hash = auction.commitmentHash(other, alice, 50e6, SALT);
        vm.prank(alice);
        auction.commit(other, hash);
        vm.warp(1110);
        _reveal(alice, 100e6);
        vm.prank(alice);
        auction.reveal(other, 50e6, SALT);
        vm.warp(1210);
        auction.finalize(id);
        _refund(alice);
        auction.collectProceeds();
        assertEq(token.balanceOf(address(auction)), 60e6);
        auction.finalize(other);
        vm.prank(alice);
        auction.withdrawRefund(other);
        auction.collectProceeds();
        assertEq(token.balanceOf(address(auction)), 0);
        assertEq(token.balanceOf(alice), 850e6);
    }

    function _permitSignature(uint256 signerKey, address owner, uint256 value, uint256 deadline)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 typeHash = keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );
        bytes32 structHash = keccak256(
            abi.encode(typeHash, owner, address(auction), value, token.nonces(owner), deadline)
        );
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        return vm.sign(signerKey, digest);
    }
}
