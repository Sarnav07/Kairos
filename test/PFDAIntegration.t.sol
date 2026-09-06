// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {SwapParams, ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PFDAAuction} from "../src/PFDAAuction.sol";
import {PFDAFeeHook} from "../src/PFDAFeeHook.sol";
import {PFDAExecutor} from "../src/PFDAExecutor.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract SwapCaller {
    function forward(
        PFDAExecutor executor,
        uint256 id,
        PoolKey calldata key,
        SwapParams calldata params
    ) external {
        IERC20(Currency.unwrap(params.zeroForOne ? key.currency0 : key.currency1))
            .approve(address(executor), type(uint256).max);
        executor.swap(id, key, params, 1, block.timestamp);
    }
}

contract ReentrySwapToken is MockUSDC {
    PFDAExecutor private target;
    uint256 private auctionId;
    PoolKey private pool;
    SwapParams private params;
    bool private armed;
    bool public blocked;
    bool public eligibilityCleared;

    function arm(
        PFDAExecutor executor,
        uint256 id,
        PoolKey calldata key,
        SwapParams calldata params_
    ) external {
        target = executor;
        auctionId = id;
        pool = key;
        params = params_;
        armed = true;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (armed) {
            armed = false;
            eligibilityCleared = !target.isEligible(PoolIdLibrary.toId(pool), address(target));
            try target.swap(auctionId, pool, params, 1, block.timestamp) {
                revert("reentry allowed");
            } catch (bytes memory reason) {
                require(
                    keccak256(reason)
                        == keccak256(
                            abi.encodeWithSelector(
                                ReentrancyGuard.ReentrancyGuardReentrantCall.selector
                            )
                        ),
                    "unexpected rejection"
                );
                blocked = true;
            }
        }
        return super.transferFrom(from, to, value);
    }
}

contract PFDAIntegrationTest is Test {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    IPoolManager internal manager;
    PFDAAuction internal auction;
    PFDAExecutor internal executor;
    PFDAFeeHook internal hook;
    PoolKey internal key;
    PoolModifyLiquidityTest internal liquidityRouter;
    PoolSwapTest internal ordinaryRouter;
    MockUSDC internal bidToken;
    ReentrySwapToken internal token0;
    ReentrySwapToken internal token1;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal treasury = address(0xFEE);
    uint256 internal id;
    bytes32 internal constant SALT = keccak256("integration fixture salt");

    function setUp() public {
        vm.warp(1000);
        manager = IPoolManager(address(new PoolManager(address(this))));
        bidToken = new MockUSDC();
        auction = new PFDAAuction(bidToken, 60);
        executor = new PFDAExecutor(manager, auction);
        address hookAddress = address(
            uint160(
                Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
                    | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
            )
        );
        deployCodeTo(
            "PFDAFeeHook.sol:PFDAFeeHook",
            abi.encode(manager, executor, treasury, uint24(500)),
            hookAddress
        );
        hook = PFDAFeeHook(hookAddress);
        ReentrySwapToken a = new ReentrySwapToken();
        ReentrySwapToken b = new ReentrySwapToken();
        (token0, token1) = address(a) < address(b) ? (a, b) : (b, a);
        liquidityRouter = new PoolModifyLiquidityTest(manager);
        ordinaryRouter = new PoolSwapTest(manager);
        token0.mint(address(this), 1e25);
        token1.mint(address(this), 1e25);
        token0.approve(address(liquidityRouter), type(uint256).max);
        token1.approve(address(liquidityRouter), type(uint256).max);
        key = PoolKey(
            Currency.wrap(address(token0)),
            Currency.wrap(address(token1)),
            2500,
            60,
            IHooks(hookAddress)
        );
        _initialize(key);
        _fund(alice);
        _fund(bob);
        id = auction.createAuction(
            key.toId(), PFDAAuction.Schedule(1000, 1100, 1200, 1260, 1360), 10e6, 1e6
        );
        _commit(id, alice, 100e6);
        _commit(id, bob, 150e6);
        vm.warp(1100);
        _reveal(id, alice, 100e6);
        _reveal(id, bob, 150e6);
        vm.warp(1200);
        auction.finalize(id);
        vm.warp(1260);
    }

    function _initialize(PoolKey memory pool) internal {
        manager.initialize(pool, uint160(1 << 96));
        liquidityRouter.modifyLiquidity(
            pool, ModifyLiquidityParams(-600, 600, 1e18, bytes32(0)), ""
        );
    }

    function _fund(address user) internal {
        bidToken.mint(user, 1000e6);
        token0.mint(user, 1e18);
        token1.mint(user, 1e18);
        vm.startPrank(user);
        bidToken.approve(address(auction), type(uint256).max);
        token0.approve(address(executor), type(uint256).max);
        token1.approve(address(executor), type(uint256).max);
        token0.approve(address(ordinaryRouter), type(uint256).max);
        token1.approve(address(ordinaryRouter), type(uint256).max);
        vm.stopPrank();
    }

    function _commit(uint256 auctionId, address user, uint128 amount) internal {
        bytes32 hash = auction.commitmentHash(auctionId, user, amount, SALT);
        vm.prank(user);
        auction.commit(auctionId, hash);
    }

    function _reveal(uint256 auctionId, address user, uint128 amount) internal {
        vm.prank(user);
        auction.reveal(auctionId, amount, SALT);
    }

    function _params(bool direction) internal pure returns (SwapParams memory) {
        return SwapParams(
            direction,
            -int256(1000e6),
            direction ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
        );
    }

    function _swap(address user, bool direction) internal returns (uint256) {
        vm.prank(user);
        return executor.swap(id, key, _params(direction), 1, block.timestamp);
    }

    function _assertClean() internal view {
        assertFalse(executor.isEligible(key.toId(), address(executor)));
        assertEq(token0.balanceOf(address(executor)), 0);
        assertEq(token1.balanceOf(address(executor)), 0);
    }

    function testFuzzAuctionToSwapBothDirections(uint96 rawAmount, bool direction) public {
        uint256 amount = bound(rawAmount, 10_000, 1e12);
        SwapParams memory params = _params(direction);
        // amount <= 1e12 by the bound above.
        // forge-lint: disable-next-line(unsafe-typecast)
        params.amountSpecified = -int256(amount);
        MockUSDC input = direction ? token0 : token1;
        MockUSDC outputToken = direction ? token1 : token0;
        uint256 beforeInput = input.balanceOf(bob);
        uint256 beforeOutput = outputToken.balanceOf(bob);
        assertEq(auction.activeWinner(id), bob);
        uint256 snapshot = vm.snapshotState();
        vm.prank(bob);
        uint256 winnerOutput = executor.swap(id, key, params, 1, block.timestamp);
        assertEq(input.balanceOf(treasury), 0);
        assertEq(beforeInput - input.balanceOf(bob), amount);
        assertEq(outputToken.balanceOf(bob) - beforeOutput, winnerOutput);
        (,,, uint24 lpFee) = manager.getSlot0(key.toId());
        assertEq(lpFee, 2500);
        _assertClean();
        assertTrue(vm.revertToState(snapshot));
        vm.prank(alice);
        uint256 loserOutput = executor.swap(id, key, params, 1, block.timestamp);
        assertGt(winnerOutput, loserOutput);
        assertEq(input.balanceOf(treasury), amount * 500 / 1e6);
        assertEq(input.balanceOf(bob), beforeInput, "loser cannot spend winner allowances");
        auction.collectProceeds();
        assertEq(bidToken.balanceOf(address(this)), 150e6);
        _assertClean();
    }

    function testWinnerThenLoserDoesNotInheritWaiver() public {
        _swap(bob, true);
        _swap(alice, true);
        assertEq(token0.balanceOf(treasury), 500_000);
        _assertClean();
    }

    function testBeforeActivationAndAtExpiryChargeOrdinaryFee() public {
        vm.warp(1259);
        _swap(bob, true);
        assertEq(token0.balanceOf(treasury), 500_000);
        vm.warp(1260);
        _swap(bob, true);
        assertEq(token0.balanceOf(treasury), 500_000);
        vm.warp(1360);
        _swap(bob, true);
        assertEq(token0.balanceOf(treasury), 1_000_000);
    }

    function testOrdinaryRouterCannotSpoofWinnerWithHookData() public {
        vm.prank(bob);
        ordinaryRouter.swap(
            key,
            _params(true),
            PoolSwapTest.TestSettings(false, false),
            abi.encode(bob, address(executor), id, true)
        );
        assertEq(token0.balanceOf(treasury), 500_000);
        _assertClean();
    }

    function testProxyCannotUseWinnersTxOriginOrApproval() public {
        SwapCaller proxy = new SwapCaller();
        token0.mint(address(proxy), 1000e6);
        uint256 balance = token0.balanceOf(bob);
        vm.prank(bob, bob);
        proxy.forward(executor, id, key, _params(true));
        assertEq(token0.balanceOf(bob), balance);
        assertEq(token0.balanceOf(treasury), 500_000);
        assertGt(token1.balanceOf(address(proxy)), 0);
    }

    function testWrongPoolRejectedBeforeTransfer() public {
        PoolKey memory other = key;
        other.fee = 3000;
        vm.prank(bob);
        vm.expectRevert(PFDAExecutor.WrongPool.selector);
        executor.swap(id, other, _params(true), 1, block.timestamp);
        _assertClean();
    }

    function testOtherPoolAuctionDoesNotInheritWinner() public {
        PoolKey memory other = key;
        other.fee = 3000;
        _initialize(other);
        uint256 otherId = auction.createAuction(
            other.toId(), PFDAAuction.Schedule(1260, 1300, 1400, 1460, 1560), 10e6, 1e6
        );
        vm.prank(bob);
        executor.swap(otherId, other, _params(true), 1, block.timestamp);
        assertEq(token0.balanceOf(treasury), 500_000);
    }

    function testUnauthenticatedAndIdleManagerCallbacksRejected() public {
        vm.expectRevert(PFDAExecutor.InvalidCallback.selector);
        executor.unlockCallback("");
        vm.prank(address(manager));
        vm.expectRevert(PFDAExecutor.InvalidCallback.selector);
        executor.unlockCallback(abi.encode(bob, true));
    }

    function testMinimumOutputRevertsAtomicallyAndCanRetry() public {
        uint256 balance = token0.balanceOf(alice);
        (uint160 price,,,) = manager.getSlot0(key.toId());
        vm.prank(alice);
        vm.expectRevert(PFDAExecutor.InsufficientOutput.selector);
        executor.swap(id, key, _params(true), type(uint256).max, block.timestamp);
        assertEq(token0.balanceOf(alice), balance);
        assertEq(token0.balanceOf(treasury), 0);
        (uint160 afterPrice,,,) = manager.getSlot0(key.toId());
        assertEq(afterPrice, price);
        _assertClean();
        _swap(bob, true);
    }

    function testDeadlineAndExactOutputRejected() public {
        vm.expectRevert(PFDAExecutor.DeadlineExpired.selector);
        executor.swap(id, key, _params(true), 1, block.timestamp - 1);
        SwapParams memory params = _params(true);
        params.amountSpecified = 1000e6;
        vm.expectRevert(PFDAExecutor.UnsupportedSwap.selector);
        executor.swap(id, key, params, 1, block.timestamp);
    }

    function testMissingApprovalRevertsAndClearsEligibility() public {
        vm.prank(bob);
        token0.approve(address(executor), 0);
        vm.expectRevert();
        _swap(bob, true);
        _assertClean();
        _swap(alice, true);
        assertEq(token0.balanceOf(treasury), 500_000);
    }

    function testReentryDuringSettlementBlockedAndEligibilityAlreadyCleared() public {
        token0.arm(executor, id, key, _params(true));
        _swap(bob, true);
        assertTrue(token0.blocked());
        assertTrue(token0.eligibilityCleared());
        _assertClean();
    }

    function testSequentialAuctionHandoverAndStaleId() public {
        uint256 next = auction.createAuction(
            key.toId(), PFDAAuction.Schedule(1260, 1300, 1400, 1460, 1560), 10e6, 1e6
        );
        _commit(next, alice, 100e6);
        vm.warp(1300);
        _reveal(next, alice, 100e6);
        vm.warp(1400);
        auction.finalize(next);
        vm.warp(1460);
        _swap(bob, true); // old id expired
        assertEq(token0.balanceOf(treasury), 500_000);
        id = next;
        _swap(bob, true); // former winner cannot claim new right
        assertEq(token0.balanceOf(treasury), 1_000_000);
        _swap(alice, true);
        assertEq(token0.balanceOf(treasury), 1_000_000);
    }

    function testUnfinalizedAndCancelledAuctionsNeverDiscount() public {
        uint256 next = auction.createAuction(
            key.toId(), PFDAAuction.Schedule(1260, 1300, 1400, 1460, 1560), 10e6, 1e6
        );
        _commit(next, alice, 100e6);
        vm.warp(1300);
        _reveal(next, alice, 100e6);
        vm.warp(1460);
        id = next;
        _swap(alice, true);
        assertEq(token0.balanceOf(treasury), 500_000);
        auction.finalize(next);
        _swap(alice, true);
        assertEq(token0.balanceOf(treasury), 1_000_000);
        assertTrue(auction.getAuction(next).cancelled);
    }

    function testWinnerStillPaysNativeProtocolFee() public {
        manager.setProtocolFeeController(address(this));
        manager.setProtocolFee(key, uint24(500 | (500 << 12)));
        _swap(bob, true);
        assertEq(token0.balanceOf(treasury), 0);
        assertGt(manager.protocolFeesAccrued(key.currency0), 0);
    }

    function testWrongEligibilityHookRejected() public {
        PFDAExecutor otherExecutor = new PFDAExecutor(manager, auction);
        address otherHookAddress = address(uint160(address(hook)) | uint160(1 << 14));
        deployCodeTo(
            "PFDAFeeHook.sol:PFDAFeeHook",
            abi.encode(manager, otherExecutor, treasury, uint24(500)),
            otherHookAddress
        );
        PoolKey memory other = key;
        other.hooks = IHooks(otherHookAddress);
        uint256 otherId = auction.createAuction(
            other.toId(), PFDAAuction.Schedule(1260, 1300, 1400, 1460, 1560), 10e6, 1e6
        );
        vm.prank(bob);
        vm.expectRevert(PFDAExecutor.WrongHook.selector);
        executor.swap(otherId, other, _params(true), 1, block.timestamp);
    }

    function testWrongManagerRejected() public {
        IPoolManager otherManager = IPoolManager(address(new PoolManager(address(this))));
        PFDAExecutor otherExecutor = new PFDAExecutor(otherManager, auction);
        vm.prank(bob);
        vm.expectRevert(PFDAExecutor.WrongHook.selector);
        otherExecutor.swap(id, key, _params(true), 1, block.timestamp);
    }

    function testPartialFillRollsBackSurchargeAndExecutorContext() public {
        SwapParams memory params = _params(true);
        params.amountSpecified = -int256(1e15);
        params.sqrtPriceLimitX96 = TickMath.getSqrtPriceAtTick(-1);
        uint256 balance = token0.balanceOf(alice);
        vm.prank(alice);
        vm.expectRevert(); // The real hook rejects incomplete exact-input execution.
        executor.swap(id, key, params, 1, block.timestamp);
        assertEq(token0.balanceOf(alice), balance);
        assertEq(token0.balanceOf(treasury), 0);
        _assertClean();
        _swap(bob, true);
    }

    function testZeroMinimumOutputAndOversizedInputRejected() public {
        vm.expectRevert(PFDAExecutor.UnsupportedSwap.selector);
        executor.swap(id, key, _params(true), 0, block.timestamp);
        SwapParams memory params = _params(true);
        params.amountSpecified = type(int256).min;
        vm.expectRevert(PFDAExecutor.UnsupportedSwap.selector);
        executor.swap(id, key, params, 1, block.timestamp);
    }

    function testInvalidConstructorRejected() public {
        vm.expectRevert(PFDAExecutor.InvalidConfiguration.selector);
        new PFDAExecutor(IPoolManager(address(0)), auction);
        vm.expectRevert(PFDAExecutor.InvalidConfiguration.selector);
        new PFDAExecutor(manager, PFDAAuction(address(0)));
    }
}
