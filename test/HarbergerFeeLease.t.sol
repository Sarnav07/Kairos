// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PFDAAuction} from "../src/PFDAAuction.sol";
import {HarbergerFeeLease} from "../src/HarbergerFeeLease.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";

contract HarbergerFeeLeaseTest is Test {
    uint128 internal constant MINIMUM_VALUATION = 100e6;
    uint128 internal constant INITIAL_COLLATERAL = 1e6;
    uint16 internal constant RENT_RATE_BPS = 1_000;
    uint64 internal constant SETTLEMENT_INTERVAL = 1 days;
    uint64 internal constant GRACE_PERIOD = 6 hours;
    bytes32 internal constant SALT = keccak256("harberger initial-auction test salt");

    MockUSDC internal token;
    PFDAAuction internal auction;
    HarbergerFeeLease internal lease;
    PoolId internal pool = PoolId.wrap(bytes32(uint256(88)));
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA401);
    uint256 internal auctionId;

    function setUp() public {
        vm.warp(1000);
        token = new MockUSDC();
        auction = new PFDAAuction(token, 60);
        auctionId = auction.createAuction(
            pool, PFDAAuction.Schedule(1010, 1110, 1210, 1270, 2000), 10e6, 1e6
        );
        _fund(alice);
        _fund(bob);
        _fund(carol);
        _finalizeInitialAuction();
        lease = new HarbergerFeeLease(
            auction,
            auctionId,
            pool,
            RENT_RATE_BPS,
            MINIMUM_VALUATION,
            SETTLEMENT_INTERVAL,
            GRACE_PERIOD
        );
        _approveLease(alice);
        _approveLease(bob);
        _approveLease(carol);
        vm.prank(bob);
        lease.claimInitial(MINIMUM_VALUATION, INITIAL_COLLATERAL);
    }

    function testInitialAuctionWinnerIsTheOnlyInitialHolder() public {
        assertEq(lease.activeHolder(pool), bob);
        vm.prank(alice);
        vm.expectRevert(HarbergerFeeLease.InitialAlreadyClaimed.selector);
        lease.claimInitial(MINIMUM_VALUATION, INITIAL_COLLATERAL);
        assertEq(lease.recipient(), address(this));
        assertEq(lease.minimumPrepay(MINIMUM_VALUATION), 27_398);
    }

    function testRentSettlementPaysImmutableAuctionDeployer() public {
        vm.warp(block.timestamp + 1 days);
        lease.settle();
        HarbergerFeeLease.Lease memory state = lease.leaseState();
        assertEq(state.collateral, INITIAL_COLLATERAL - 27_397);
        assertEq(lease.rentCredit(), 27_397);
        uint256 recipientBalance = token.balanceOf(address(this));
        vm.prank(carol);
        lease.collectRent();
        assertEq(token.balanceOf(address(this)) - recipientBalance, 27_397);
        assertEq(token.balanceOf(address(lease)), lease.accountedBalance());
    }

    function testTakeoverPaysDeclaredPriceAndTransfersTheRight() public {
        vm.prank(alice);
        lease.takeOver(200e6, INITIAL_COLLATERAL);
        assertEq(lease.activeHolder(pool), alice);
        assertEq(lease.takeoverCredit(bob), MINIMUM_VALUATION);
        assertEq(lease.refundCredit(bob), INITIAL_COLLATERAL);
        uint256 before = token.balanceOf(bob);
        vm.prank(bob);
        lease.withdrawCredits();
        assertEq(token.balanceOf(bob) - before, MINIMUM_VALUATION + INITIAL_COLLATERAL);
        assertEq(token.balanceOf(address(lease)), lease.accountedBalance());
    }

    function testHolderCanTopUpChangeValuationAndRelease() public {
        vm.prank(bob);
        lease.topUp(2e6);
        vm.prank(bob);
        lease.setValuation(200e6, 0);
        HarbergerFeeLease.Lease memory state = lease.leaseState();
        assertEq(state.valuation, 200e6);
        assertEq(state.collateral, INITIAL_COLLATERAL + 2e6);
        vm.prank(bob);
        lease.release();
        assertEq(lease.activeHolder(pool), address(0));
        assertEq(lease.refundCredit(bob), INITIAL_COLLATERAL + 2e6);
        assertEq(token.balanceOf(address(lease)), lease.accountedBalance());
    }

    function testInsolvencySuspendsThenHolderCanCureDuringGrace() public {
        vm.warp(lease.solvencyUntil() + 1);
        lease.settle();
        assertEq(lease.activeHolder(pool), address(0));
        HarbergerFeeLease.Lease memory state = lease.leaseState();
        uint128 cureAmount = uint128(state.arrears + lease.minimumPrepay(state.valuation));
        vm.prank(bob);
        lease.cure(cureAmount);
        state = lease.leaseState();
        assertEq(state.arrears, 0);
        assertEq(lease.activeHolder(pool), bob);
        assertEq(token.balanceOf(address(lease)), lease.accountedBalance());
    }

    function testPermissionlessLiquidationAfterGraceMakesRightVacant() public {
        vm.warp(lease.solvencyUntil() + 1);
        lease.settle();
        HarbergerFeeLease.Lease memory state = lease.leaseState();
        vm.warp(uint256(state.insolventAt) + GRACE_PERIOD + 1);
        vm.prank(carol);
        lease.liquidate();
        assertEq(lease.activeHolder(pool), address(0));
        vm.prank(carol);
        lease.claimVacant(MINIMUM_VALUATION, INITIAL_COLLATERAL);
        assertEq(lease.activeHolder(pool), carol);
        assertEq(token.balanceOf(address(lease)), lease.accountedBalance());
    }

    function testFuzzTakeoverPreservesTokenAccounting(uint96 rawDeposit, uint96 rawValuation)
        public
    {
        uint128 deposit = uint128(bound(rawDeposit, 27_398, 500e6));
        uint128 valuation = uint128(bound(rawValuation, MINIMUM_VALUATION, 500e6));
        uint256 minimum = lease.minimumPrepay(valuation);
        if (deposit < minimum) deposit = uint128(minimum);
        vm.prank(alice);
        lease.takeOver(valuation, deposit);
        assertEq(token.balanceOf(address(lease)), lease.accountedBalance());
        vm.prank(bob);
        lease.withdrawCredits();
        assertEq(token.balanceOf(address(lease)), lease.accountedBalance());
    }

    function _finalizeInitialAuction() internal {
        vm.warp(1010);
        _commit(alice, 100e6);
        _commit(bob, 150e6);
        vm.warp(1110);
        _reveal(alice, 100e6);
        _reveal(bob, 150e6);
        vm.warp(1210);
        auction.finalize(auctionId);
        vm.warp(1270);
        assertEq(auction.activeWinner(auctionId), bob);
    }

    function _fund(address account) internal {
        token.mint(account, 1_000e6);
        vm.prank(account);
        token.approve(address(auction), type(uint256).max);
    }

    function _approveLease(address account) internal {
        vm.prank(account);
        token.approve(address(lease), type(uint256).max);
    }

    function _commit(address account, uint128 amount) internal {
        bytes32 commitment = auction.commitmentHash(auctionId, account, amount, SALT);
        vm.prank(account);
        auction.commit(auctionId, commitment);
    }

    function _reveal(address account, uint128 amount) internal {
        vm.prank(account);
        auction.reveal(auctionId, amount, SALT);
    }
}
