// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {SwapParams, ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PFDAAuction} from "../src/PFDAAuction.sol";
import {PFDAFeeHook} from "../src/PFDAFeeHook.sol";
import {HarbergerFeeLease} from "../src/HarbergerFeeLease.sol";
import {HarbergerExecutor} from "../src/HarbergerExecutor.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract HarbergerIntegrationTest is Test {
    using PoolIdLibrary for PoolKey;

    IPoolManager internal manager;
    PFDAAuction internal auction;
    HarbergerFeeLease internal lease;
    HarbergerExecutor internal executor;
    PFDAFeeHook internal hook;
    PoolModifyLiquidityTest internal liquidityRouter;
    PoolKey internal key;
    MockUSDC internal bidToken;
    MockUSDC internal token0;
    MockUSDC internal token1;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal treasury = address(0xFEE);
    uint256 internal auctionId;
    bytes32 internal constant SALT = keccak256("harberger-v4 integration salt");

    function setUp() public {
        vm.warp(1000);
        manager = IPoolManager(address(new PoolManager(address(this))));
        bidToken = new MockUSDC();
        MockUSDC first = new MockUSDC();
        MockUSDC second = new MockUSDC();
        (token0, token1) = address(first) < address(second) ? (first, second) : (second, first);

        address hookAddress = address(
            uint160(
                Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
                    | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
            )
        );
        key = PoolKey(
            Currency.wrap(address(token0)),
            Currency.wrap(address(token1)),
            2500,
            60,
            IHooks(hookAddress)
        );
        auction = new PFDAAuction(bidToken, 60);
        auctionId = auction.createAuction(
            key.toId(), PFDAAuction.Schedule(1010, 1110, 1210, 1270, 3000), 10e6, 1e6
        );
        _fundAuctionBidder(alice);
        _fundAuctionBidder(bob);
        _finalizeInitialAuction();
        lease = new HarbergerFeeLease(auction, auctionId, key.toId(), 1_000, 100e6, 1 days, 6 hours);
        executor = new HarbergerExecutor(manager, lease, key.toId());
        deployCodeTo(
            "PFDAFeeHook.sol:PFDAFeeHook",
            abi.encode(manager, executor, treasury, uint24(500)),
            hookAddress
        );
        hook = PFDAFeeHook(hookAddress);
        liquidityRouter = new PoolModifyLiquidityTest(manager);
        _seedPool();
        _fundTrader(alice);
        _fundTrader(bob);
        vm.prank(bob);
        bidToken.approve(address(lease), type(uint256).max);
        vm.prank(alice);
        bidToken.approve(address(lease), type(uint256).max);
        vm.prank(bob);
        lease.claimInitial(100e6, 1e6);
    }

    function testActiveLeaseHolderReceivesWaiverAndOrdinaryTraderDoesNot() public {
        uint256 snapshot = vm.snapshotState();
        uint256 winnerOutput = _swap(bob);
        assertEq(token0.balanceOf(treasury), 0);
        assertTrue(vm.revertToState(snapshot));
        uint256 ordinaryOutput = _swap(alice);
        assertGt(winnerOutput, ordinaryOutput);
        assertEq(token0.balanceOf(treasury), 500_000);
        _assertExecutorClean();
    }

    function testTakeoverSwitchesExecutorEligibility() public {
        vm.prank(alice);
        lease.takeOver(200e6, 1e6);
        _swap(alice);
        assertEq(token0.balanceOf(treasury), 0);
        _swap(bob);
        assertEq(token0.balanceOf(treasury), 500_000);
        _assertExecutorClean();
    }

    function testInsolvencyImmediatelyRemovesWaiver() public {
        vm.warp(lease.solvencyUntil() + 1);
        assertEq(lease.activeHolder(key.toId()), address(0));
        _swap(bob);
        assertEq(token0.balanceOf(treasury), 500_000);
        _assertExecutorClean();
    }

    function _seedPool() internal {
        token0.mint(address(this), 1e25);
        token1.mint(address(this), 1e25);
        token0.approve(address(liquidityRouter), type(uint256).max);
        token1.approve(address(liquidityRouter), type(uint256).max);
        manager.initialize(key, uint160(1 << 96));
        liquidityRouter.modifyLiquidity(key, ModifyLiquidityParams(-600, 600, 1e18, bytes32(0)), "");
    }

    function _fundAuctionBidder(address account) internal {
        bidToken.mint(account, 1_000e6);
        vm.prank(account);
        bidToken.approve(address(auction), type(uint256).max);
    }

    function _fundTrader(address account) internal {
        token0.mint(account, 1e18);
        token1.mint(account, 1e18);
        vm.startPrank(account);
        token0.approve(address(executor), type(uint256).max);
        token1.approve(address(executor), type(uint256).max);
        vm.stopPrank();
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

    function _swap(address account) internal returns (uint256) {
        vm.prank(account);
        return executor.swap(
            key, SwapParams(true, -int256(1000e6), TickMath.MIN_SQRT_PRICE + 1), 1, block.timestamp
        );
    }

    function _assertExecutorClean() internal view {
        assertFalse(executor.isEligible(key.toId(), address(executor)));
        assertEq(token0.balanceOf(address(executor)), 0);
        assertEq(token1.balanceOf(address(executor)), 0);
    }
}
