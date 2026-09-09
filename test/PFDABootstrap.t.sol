// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PFDAAuction} from "../src/PFDAAuction.sol";
import {PFDAExecutor} from "../src/PFDAExecutor.sol";
import {PFDAFeeHook} from "../src/PFDAFeeHook.sol";
import {MockTradeToken} from "../src/mocks/MockTradeToken.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract PFDABootstrapTest is Test {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    IPoolManager private manager;
    PFDAAuction private auction;
    PFDAExecutor private executor;
    PFDAFeeHook private hook;
    MockTradeToken private alpha;
    MockTradeToken private beta;
    PoolModifyLiquidityTest private liquidityRouter;

    uint160 private constant START_PRICE_X96 = uint160(1 << 96);
    uint128 private constant INITIAL_LIQUIDITY = 1e21;
    uint256 private constant MINTED_PER_TOKEN = 1_000_000e18;

    function setUp() public {
        manager = IPoolManager(address(new PoolManager(address(this))));
        auction = new PFDAAuction(new MockUSDC(), 30 minutes);
        executor = new PFDAExecutor(manager, auction);
        address hookAddress = address(
            uint160(
                Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
                    | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
            )
        );
        deployCodeTo(
            "PFDAFeeHook.sol:PFDAFeeHook",
            abi.encode(manager, executor, address(this), uint24(500)),
            hookAddress
        );
        hook = PFDAFeeHook(hookAddress);
        alpha = new MockTradeToken("Kairos Alpha", "KRA");
        beta = new MockTradeToken("Kairos Beta", "KRB");
        liquidityRouter = new PoolModifyLiquidityTest(manager);
    }

    function testBootstrapInitializesSortedHookPoolAndSeedsLiquidity() public {
        alpha.mint(address(this), MINTED_PER_TOKEN);
        beta.mint(address(this), MINTED_PER_TOKEN);
        alpha.approve(address(liquidityRouter), type(uint256).max);
        beta.approve(address(liquidityRouter), type(uint256).max);

        PoolKey memory key = _key(address(alpha), address(beta));
        manager.initialize(key, START_PRICE_X96);
        liquidityRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams(-600, 600, int256(uint256(INITIAL_LIQUIDITY)), bytes32(0)),
            ""
        );

        (uint160 sqrtPriceX96,,,) = manager.getSlot0(key.toId());
        assertEq(sqrtPriceX96, START_PRICE_X96);
        assertLt(alpha.balanceOf(address(this)), MINTED_PER_TOKEN);
        assertLt(beta.balanceOf(address(this)), MINTED_PER_TOKEN);
        assertEq(address(executor.manager()), address(manager));
        assertEq(address(executor.auction()), address(auction));
        assertEq(address(hook.manager()), address(manager));
        assertEq(address(hook.eligibility()), address(executor));
    }

    function testTradeTokensAreExplicitlyValuelessEighteenDecimalDemoAssets() public view {
        assertEq(alpha.decimals(), 18);
        assertEq(beta.decimals(), 18);
        assertEq(alpha.symbol(), "KRA");
        assertEq(beta.symbol(), "KRB");
    }

    function _key(address first, address second) private view returns (PoolKey memory key) {
        (address currency0, address currency1) = first < second ? (first, second) : (second, first);
        key = PoolKey({
            currency0: Currency.wrap(currency0),
            currency1: Currency.wrap(currency1),
            fee: 2_500,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
    }
}
