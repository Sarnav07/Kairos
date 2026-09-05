// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {CustomRevert} from "v4-core/src/libraries/CustomRevert.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {SwapParams, ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "v4-core/src/types/BalanceDelta.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PFDAFeeHook} from "../src/PFDAFeeHook.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {EligibilityFixture} from "./fixtures/EligibilityFixture.sol";

contract PFDAFeeHookTest is Test {
    using SafeCast for uint256;
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    IPoolManager internal manager;
    PFDAFeeHook internal hook;
    EligibilityFixture internal eligibility;
    PoolSwapTest internal router;
    PoolModifyLiquidityTest internal liquidityRouter;
    PoolKey internal key;
    PoolKey internal baseline;
    MockUSDC internal token0;
    MockUSDC internal token1;
    address internal treasury = address(0xFEE);
    uint24 internal constant LP_FEE = 2500;
    uint24 internal constant SURCHARGE = 500;
    uint160 internal constant START_PRICE = uint160(1 << 96);

    struct Observation {
        uint256 output;
        uint256 growth0;
        uint256 growth1;
        uint256 nativeProtocolFees;
        uint160 price;
    }

    function setUp() public {
        manager = IPoolManager(address(new PoolManager(address(this))));
        router = new PoolSwapTest(manager);
        liquidityRouter = new PoolModifyLiquidityTest(manager);
        eligibility = new EligibilityFixture();
        address hookAddress = address(
            uint160(
                Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
                    | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
            )
        );
        deployCodeTo(
            "PFDAFeeHook.sol:PFDAFeeHook",
            abi.encode(manager, eligibility, treasury, SURCHARGE),
            hookAddress
        );
        hook = PFDAFeeHook(hookAddress);

        MockUSDC a = new MockUSDC();
        MockUSDC b = new MockUSDC();
        (token0, token1) = address(a) < address(b) ? (a, b) : (b, a);
        token0.mint(address(this), 1e25);
        token1.mint(address(this), 1e25);
        token0.approve(address(router), type(uint256).max);
        token1.approve(address(router), type(uint256).max);
        token0.approve(address(liquidityRouter), type(uint256).max);
        token1.approve(address(liquidityRouter), type(uint256).max);
        key = PoolKey(
            Currency.wrap(address(token0)),
            Currency.wrap(address(token1)),
            LP_FEE,
            60,
            IHooks(hookAddress)
        );
        baseline = key;
        baseline.hooks = IHooks(address(0));
        _initialize(key);
        _initialize(baseline);
    }

    function _initialize(PoolKey memory pool) internal {
        manager.initialize(pool, START_PRICE);
        liquidityRouter.modifyLiquidity(
            pool,
            ModifyLiquidityParams({
                tickLower: -600, tickUpper: 600, liquidityDelta: 1e18, salt: bytes32(0)
            }),
            ""
        );
    }

    function _params(uint256 amount, bool direction) internal pure returns (SwapParams memory) {
        return SwapParams({
            zeroForOne: direction,
            amountSpecified: -amount.toInt256(),
            sqrtPriceLimitX96: direction ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
        });
    }

    function _swap(PoolKey memory pool, SwapParams memory params, bytes memory hookData)
        internal
        returns (BalanceDelta)
    {
        return router.swap(
            pool,
            params,
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            hookData
        );
    }

    function _observe(PoolKey memory pool, uint256 amount, bool direction)
        internal
        returns (Observation memory result)
    {
        Currency input = direction ? pool.currency0 : pool.currency1;
        uint256 protocolBefore = manager.protocolFeesAccrued(input);
        BalanceDelta delta = _swap(pool, _params(amount, direction), "");
        assertEq(-int256(direction ? delta.amount0() : delta.amount1()), amount.toInt256());
        result.output = uint256(int256(direction ? delta.amount1() : delta.amount0()));
        (result.growth0, result.growth1) = manager.getFeeGrowthGlobals(pool.toId());
        uint24 lpFee;
        (result.price,,, lpFee) = manager.getSlot0(pool.toId());
        assertEq(lpFee, LP_FEE, "LP rate changed");
        result.nativeProtocolFees = manager.protocolFeesAccrued(input) - protocolBefore;
    }

    function _assertAccounting(uint256 grossInput, bool direction, bool winner, bool nativeFee)
        internal
    {
        if (nativeFee) {
            manager.setProtocolFeeController(address(this));
            uint24 packedFee = uint24(500 | (500 << 12));
            manager.setProtocolFee(key, packedFee);
            manager.setProtocolFee(baseline, packedFee);
        }
        eligibility.setEligible(key.toId(), address(router), winner);
        uint256 surcharge = winner ? 0 : grossInput * SURCHARGE / 1e6;
        MockUSDC input = direction ? token0 : token1;
        uint256 balanceBefore = input.balanceOf(address(this));
        uint256 managerBefore = input.balanceOf(address(manager));
        Observation memory actual = _observe(key, grossInput, direction);
        assertEq(input.balanceOf(treasury), surcharge, "surcharge not paid to recipient");
        assertEq(balanceBefore - input.balanceOf(address(this)), grossInput);
        assertEq(input.balanceOf(address(manager)) - managerBefore, grossInput - surcharge);
        assertEq(token0.balanceOf(address(hook)), 0);
        assertEq(token1.balanceOf(address(hook)), 0);

        // Equal AMM input means identical LP fees, output and price movement to an unhooked pool.
        Observation memory control = _observe(baseline, grossInput - surcharge, direction);
        assertEq(actual.output, control.output, "hook changed AMM output");
        assertEq(actual.price, control.price, "hook changed price movement");
        assertEq(actual.growth0, control.growth0, "token0 LP fee growth mismatch");
        assertEq(actual.growth1, control.growth1, "token1 LP fee growth mismatch");
        assertGt(direction ? actual.growth0 : actual.growth1, 0);
        assertEq(actual.nativeProtocolFees, control.nativeProtocolFees);
        if (nativeFee) {
            assertGt(actual.nativeProtocolFees, 0, "native protocol fees must still apply");
        } else {
            assertEq(actual.nativeProtocolFees, 0);
        }
    }

    function testNonWinnerZeroForOne() public {
        _assertAccounting(1000e6, true, false, false);
    }

    function testNonWinnerOneForZero() public {
        _assertAccounting(1000e6, false, false, false);
    }

    function testWinnerZeroForOne() public {
        _assertAccounting(1000e6, true, true, false);
    }

    function testWinnerOneForZero() public {
        _assertAccounting(1000e6, false, true, false);
    }

    function testWinnerStillPaysNativeProtocolFee() public {
        _assertAccounting(1000e6, true, true, true);
    }

    function testNonWinnerStillPaysNativeProtocolFee() public {
        _assertAccounting(1000e6, false, false, true);
    }

    function testFuzzAccounting(uint96 amount, bool direction, bool winner, bool nativeFee) public {
        _assertAccounting(bound(uint256(amount), 10_000, 1e12), direction, winner, nativeFee);
    }

    function testSurchargeRoundsDownBelowOneUnit() public {
        _assertAccounting(1999, true, false, false);
    }

    function testFirstNonZeroSurchargeUnit() public {
        _assertAccounting(2000, false, false, false);
    }

    function testHookDataCannotGrantDiscount() public {
        _swap(key, _params(1000e6, true), abi.encode(address(this), true));
        assertEq(token0.balanceOf(treasury), 500_000);
    }

    function testEligibilityIsPoolSpecific() public {
        eligibility.setEligible(baseline.toId(), address(router), true);
        _swap(key, _params(1000e6, true), "");
        assertEq(token0.balanceOf(treasury), 500_000);
    }

    function testDirectBeforeSwapRejected() public {
        vm.expectRevert(PFDAFeeHook.OnlyPoolManager.selector);
        hook.beforeSwap(address(router), key, _params(1000e6, true), "");
    }

    function testDirectAfterSwapRejected() public {
        vm.expectRevert(PFDAFeeHook.OnlyPoolManager.selector);
        hook.afterSwap(
            address(router), key, _params(1000e6, true), BalanceDeltaLibrary.ZERO_DELTA, ""
        );
    }

    function testExactOutputRejected() public {
        SwapParams memory params = _params(1000e6, true);
        params.amountSpecified = 1000e6;
        _expectHookError(IHooks.beforeSwap.selector, PFDAFeeHook.UnsupportedSwap.selector);
        _swap(key, params, "");
        assertEq(token0.balanceOf(treasury), 0);
    }

    function testPartialFillRevertsAndRollsBackSurcharge() public {
        uint256 balanceBefore = token0.balanceOf(address(this));
        SwapParams memory params = _params(1e15, true);
        params.sqrtPriceLimitX96 = TickMath.getSqrtPriceAtTick(-1);
        _expectHookError(IHooks.afterSwap.selector, PFDAFeeHook.PartialFill.selector);
        _swap(key, params, "");
        assertEq(token0.balanceOf(treasury), 0);
        assertEq(token0.balanceOf(address(this)), balanceBefore);
        (uint160 price,,,) = manager.getSlot0(key.toId());
        assertEq(price, START_PRICE);
    }

    function _expectHookError(bytes4 callback, bytes4 reason) internal {
        vm.expectRevert(
            abi.encodeWithSelector(
                CustomRevert.WrappedError.selector,
                address(hook),
                callback,
                abi.encodeWithSelector(reason),
                abi.encodeWithSelector(Hooks.HookCallFailed.selector)
            )
        );
    }

    function testFuzzSameGrossWinnerAdvantage(bool direction) public {
        uint256 snapshot = vm.snapshotState();
        Observation memory ordinary = _observe(key, 1000e6, direction);
        assertTrue(vm.revertToState(snapshot));
        eligibility.setEligible(key.toId(), address(router), true);
        Observation memory winner = _observe(key, 1000e6, direction);
        assertGt(
            winner.output, ordinary.output, "winner must receive more for the same gross input"
        );
        // The LP rate is fixed and the winner sends more of its gross input through the AMM.
        assertGt(
            direction ? winner.growth0 : winner.growth1,
            direction ? ordinary.growth0 : ordinary.growth1
        );
        assertEq((direction ? token0 : token1).balanceOf(treasury), 0);
    }

    function testZeroRecipientRejected() public {
        vm.expectRevert(PFDAFeeHook.InvalidConfiguration.selector);
        new PFDAFeeHook(manager, eligibility, address(0), SURCHARGE);
    }

    function testExcessiveSurchargeRejected() public {
        vm.expectRevert(PFDAFeeHook.InvalidConfiguration.selector);
        new PFDAFeeHook(manager, eligibility, treasury, 10_001);
    }

    function testOversizedInputRejected() public {
        SwapParams memory params = _params(uint256(type(uint128).max), true);
        _expectHookError(IHooks.beforeSwap.selector, PFDAFeeHook.UnsupportedSwap.selector);
        _swap(key, params, "");
    }
}
