// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PFDAAuction} from "../src/PFDAAuction.sol";
import {PFDAExecutor} from "../src/PFDAExecutor.sol";
import {PFDAFeeHook} from "../src/PFDAFeeHook.sol";
import {MockTradeToken} from "../src/mocks/MockTradeToken.sol";

/// @notice Creates one valueless, hook-enabled v4 demonstration pool on Unichain Sepolia.
/// @dev Uses v4-core's pinned test liquidity router solely for the testnet rehearsal. It is not a
///      production routing component. The auction is intentionally not scheduled by this script.
contract BootstrapPFDAPool is Script {
    using PoolIdLibrary for PoolKey;

    uint256 internal constant UNICHAIN_SEPOLIA_CHAIN_ID = 1301;
    address internal constant DEFAULT_AUCTION = 0xE30bd1162A9BB02C32EC8a0731014d45e1C15B73;
    address internal constant DEFAULT_EXECUTOR = 0x479E644B05876C6AD98cE59C2Fc94FB6C0E6b231;
    address internal constant DEFAULT_HOOK = 0xBeE0b2606fdb9b70Ca3FB24254B674423f1e40c8;
    uint24 internal constant LP_FEE_PPM = 2_500;
    int24 internal constant TICK_SPACING = 60;
    uint160 internal constant START_PRICE_X96 = uint160(1 << 96);
    int24 internal constant LOWER_TICK = -600;
    int24 internal constant UPPER_TICK = 600;
    uint128 internal constant INITIAL_LIQUIDITY = 1e21;
    uint256 internal constant MINTED_PER_TOKEN = 1_000_000e18;

    error UnsupportedChain(uint256 actual);
    error UnexpectedDeployer(address actual, address expected);
    error MissingCode(address target);
    error InvalidStackWiring();

    struct Bootstrap {
        address deployer;
        address poolManager;
        address auction;
        address executor;
        address hook;
        address tokenA;
        address tokenB;
        address liquidityRouter;
        PoolId poolId;
    }

    function run() external returns (Bootstrap memory bootstrapped) {
        if (block.chainid != UNICHAIN_SEPOLIA_CHAIN_ID) revert UnsupportedChain(block.chainid);

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address expectedDeployer = vm.envAddress("DEPLOYER_ADDRESS");
        if (deployer != expectedDeployer) revert UnexpectedDeployer(deployer, expectedDeployer);

        address managerAddress = vm.envAddress("POOL_MANAGER");
        address auctionAddress = vm.envOr("PFDA_AUCTION", DEFAULT_AUCTION);
        address executorAddress = vm.envOr("PFDA_EXECUTOR", DEFAULT_EXECUTOR);
        address hookAddress = vm.envOr("PFDA_HOOK", DEFAULT_HOOK);
        _validateStack(managerAddress, auctionAddress, executorAddress, hookAddress, deployer);

        vm.startBroadcast(deployerKey);
        MockTradeToken alpha = new MockTradeToken("Kairos Alpha", "KRA");
        MockTradeToken beta = new MockTradeToken("Kairos Beta", "KRB");
        PoolModifyLiquidityTest liquidityRouter =
            new PoolModifyLiquidityTest(IPoolManager(managerAddress));
        alpha.mint(deployer, MINTED_PER_TOKEN);
        beta.mint(deployer, MINTED_PER_TOKEN);
        alpha.approve(address(liquidityRouter), type(uint256).max);
        beta.approve(address(liquidityRouter), type(uint256).max);

        PoolKey memory key = _key(address(alpha), address(beta), hookAddress);
        IPoolManager(managerAddress).initialize(key, START_PRICE_X96);
        liquidityRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams(
                LOWER_TICK, UPPER_TICK, int256(uint256(INITIAL_LIQUIDITY)), bytes32(0)
            ),
            ""
        );
        vm.stopBroadcast();

        bootstrapped = Bootstrap({
            deployer: deployer,
            poolManager: managerAddress,
            auction: auctionAddress,
            executor: executorAddress,
            hook: hookAddress,
            tokenA: address(alpha),
            tokenB: address(beta),
            liquidityRouter: address(liquidityRouter),
            poolId: key.toId()
        });
        _logBootstrap(bootstrapped);
    }

    function _key(address first, address second, address hook)
        internal
        pure
        returns (PoolKey memory key)
    {
        (address currency0, address currency1) = first < second ? (first, second) : (second, first);
        key = PoolKey({
            currency0: Currency.wrap(currency0),
            currency1: Currency.wrap(currency1),
            fee: LP_FEE_PPM,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(hook)
        });
    }

    function _validateStack(
        address managerAddress,
        address auctionAddress,
        address executorAddress,
        address hookAddress,
        address deployer
    ) internal view {
        if (
            managerAddress.code.length == 0 || auctionAddress.code.length == 0
                || executorAddress.code.length == 0 || hookAddress.code.length == 0
        ) revert MissingCode(address(0));
        if (
            address(PFDAAuction(auctionAddress).deployer()) != deployer
                || address(PFDAExecutor(executorAddress).manager()) != managerAddress
                || address(PFDAExecutor(executorAddress).auction()) != auctionAddress
                || address(PFDAFeeHook(hookAddress).manager()) != managerAddress
                || address(PFDAFeeHook(hookAddress).eligibility()) != executorAddress
                || PFDAFeeHook(hookAddress).recipient() != deployer
        ) revert InvalidStackWiring();
    }

    function _logBootstrap(Bootstrap memory deployed) internal pure {
        console2.log("PFDA pool bootstrap: save only after RPC verification");
        console2.log("Kairos Alpha", deployed.tokenA);
        console2.log("Kairos Beta", deployed.tokenB);
        console2.log("Liquidity router", deployed.liquidityRouter);
        console2.log("poolId");
        console2.logBytes32(PoolId.unwrap(deployed.poolId));
    }
}
