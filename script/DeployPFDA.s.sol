// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PFDAAuction} from "../src/PFDAAuction.sol";
import {PFDAExecutor} from "../src/PFDAExecutor.sol";
import {PFDAFeeHook} from "../src/PFDAFeeHook.sol";
import {PFDAHookDeployer} from "../src/PFDAHookDeployer.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @notice Deploys the PFDA stack to Unichain Sepolia using one local, funded deployer key.
/// @dev The auction recipient is derived from DEPLOYER_PRIVATE_KEY; it cannot be redirected by config.
contract DeployPFDA is Script {
    uint256 internal constant UNICHAIN_SEPOLIA_CHAIN_ID = 1301;
    address internal constant UNICHAIN_SEPOLIA_POOL_MANAGER =
        0x00B036B58a818B1BC34d502D3fE730Db729e62AC;
    uint24 internal constant DEFAULT_SURCHARGE_PPM = 500;
    uint64 internal constant DEFAULT_ACTIVATION_DELAY = 30 minutes;
    uint256 internal constant MAX_SALT_ATTEMPTS = 1_000_000;

    error UnsupportedChain(uint256 actual);
    error InvalidManager(address manager);
    error InvalidSurcharge(uint256 surchargePpm);
    error UnexpectedDeployer(address actual, address expected);
    error SaltNotFound();

    struct Deployment {
        address deployer;
        address poolManager;
        address bidToken;
        address auction;
        address executor;
        address hookDeployer;
        address hook;
        bytes32 hookSalt;
        uint24 surchargePpm;
    }

    function run() external returns (Deployment memory deployed) {
        if (block.chainid != UNICHAIN_SEPOLIA_CHAIN_ID) revert UnsupportedChain(block.chainid);

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address expectedDeployer = vm.envAddress("DEPLOYER_ADDRESS");
        if (deployer != expectedDeployer) revert UnexpectedDeployer(deployer, expectedDeployer);
        address managerAddress = vm.envOr("POOL_MANAGER", UNICHAIN_SEPOLIA_POOL_MANAGER);
        uint256 configuredSurcharge = vm.envOr("SURCHARGE_PPM", uint256(DEFAULT_SURCHARGE_PPM));
        if (managerAddress.code.length == 0) revert InvalidManager(managerAddress);
        if (configuredSurcharge > 10_000) revert InvalidSurcharge(configuredSurcharge);

        // forge-lint: disable-next-line(unsafe-typecast)
        uint24 surchargePpm = uint24(configuredSurcharge);
        deployed = _deployBase(deployerKey, deployer, managerAddress, surchargePpm);
        _deployHook(deployerKey, deployed);
        _logDeployment(deployed);
    }

    function _deployBase(
        uint256 deployerKey,
        address deployer,
        address managerAddress,
        uint24 surchargePpm
    ) internal returns (Deployment memory deployed) {
        vm.startBroadcast(deployerKey);
        MockUSDC bidToken = new MockUSDC();
        PFDAAuction auction = new PFDAAuction(bidToken, DEFAULT_ACTIVATION_DELAY);
        PFDAExecutor executor = new PFDAExecutor(IPoolManager(managerAddress), auction);
        PFDAHookDeployer hookDeployer = new PFDAHookDeployer();
        vm.stopBroadcast();

        deployed = Deployment({
            deployer: deployer,
            poolManager: managerAddress,
            bidToken: address(bidToken),
            auction: address(auction),
            executor: address(executor),
            hookDeployer: address(hookDeployer),
            hook: address(0),
            hookSalt: bytes32(0),
            surchargePpm: surchargePpm
        });
    }

    function _deployHook(uint256 deployerKey, Deployment memory deployed) internal {
        PFDAHookDeployer hookDeployer = PFDAHookDeployer(deployed.hookDeployer);
        bytes32 initCodeHash = hookDeployer.initCodeHash(
            IPoolManager(deployed.poolManager),
            PFDAExecutor(deployed.executor),
            deployed.deployer,
            deployed.surchargePpm
        );
        bytes32 salt = _mineHookSalt(hookDeployer, initCodeHash);
        vm.startBroadcast(deployerKey);
        PFDAFeeHook hook = hookDeployer.deploy(
            salt,
            IPoolManager(deployed.poolManager),
            PFDAExecutor(deployed.executor),
            deployed.deployer,
            deployed.surchargePpm
        );
        vm.stopBroadcast();
        deployed.hook = address(hook);
        deployed.hookSalt = salt;
    }

    function _mineHookSalt(PFDAHookDeployer hookDeployer, bytes32 initCodeHash)
        internal
        view
        returns (bytes32 salt)
    {
        for (uint256 nonce; nonce < MAX_SALT_ATTEMPTS; ++nonce) {
            salt = bytes32(nonce);
            if (hookDeployer.hasExpectedPermissions(
                    hookDeployer.predictFromInitCodeHash(salt, initCodeHash)
                )) {
                return salt;
            }
        }
        revert SaltNotFound();
    }

    function _logDeployment(Deployment memory deployed) internal pure {
        console2.log("PFDA deployment: save these addresses after broadcast verification");
        console2.log("deployer / proceeds recipient", deployed.deployer);
        console2.log("PoolManager", deployed.poolManager);
        console2.log("MockUSDC", deployed.bidToken);
        console2.log("PFDAAuction", deployed.auction);
        console2.log("PFDAExecutor", deployed.executor);
        console2.log("PFDAHookDeployer", deployed.hookDeployer);
        console2.log("PFDAFeeHook", deployed.hook);
        console2.log("hook salt");
        console2.logBytes32(deployed.hookSalt);
    }
}
