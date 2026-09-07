// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {PFDAAuction} from "../src/PFDAAuction.sol";
import {PFDAExecutor} from "../src/PFDAExecutor.sol";
import {PFDAFeeHook} from "../src/PFDAFeeHook.sol";
import {PFDAHookDeployer} from "../src/PFDAHookDeployer.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract PFDAHookDeployerTest is Test {
    IPoolManager private manager;
    PFDAAuction private auction;
    PFDAExecutor private executor;
    PFDAHookDeployer private hookDeployer;

    function setUp() public {
        manager = IPoolManager(address(new PoolManager(address(this))));
        auction = new PFDAAuction(new MockUSDC(), 30 minutes);
        executor = new PFDAExecutor(manager, auction);
        hookDeployer = new PFDAHookDeployer();
    }

    function testMinedSaltDeploysHookWithExactPermissionBits() public {
        bytes32 salt = _mineSalt(address(this), 500);
        address expected = hookDeployer.predict(salt, manager, executor, address(this), 500);

        PFDAFeeHook hook = hookDeployer.deploy(salt, manager, executor, address(this), 500);

        assertEq(address(hook), expected);
        assertEq(
            uint160(address(hook)) & hookDeployer.ALL_HOOK_MASK(), hookDeployer.REQUIRED_FLAGS()
        );
        assertEq(address(hook.manager()), address(manager));
        assertEq(address(hook.eligibility()), address(executor));
        assertEq(hook.recipient(), address(this));
        assertEq(hook.surchargePpm(), 500);
        assertEq(auction.deployer(), address(this));
    }

    function testRejectsSaltWithUnexpectedPermissionBits() public {
        bytes32 initCodeHash = hookDeployer.initCodeHash(manager, executor, address(this), 500);
        bytes32 badSalt;
        for (uint256 nonce;; ++nonce) {
            badSalt = bytes32(nonce);
            if (!hookDeployer.hasExpectedPermissions(
                    hookDeployer.predictFromInitCodeHash(badSalt, initCodeHash)
                )) {
                break;
            }
        }

        address expected = hookDeployer.predictFromInitCodeHash(badSalt, initCodeHash);
        vm.expectRevert(
            abi.encodeWithSelector(PFDAHookDeployer.InvalidHookAddress.selector, expected)
        );
        hookDeployer.deploy(badSalt, manager, executor, address(this), 500);
    }

    function _mineSalt(address recipient, uint24 surchargePpm) private view returns (bytes32 salt) {
        bytes32 initCodeHash = hookDeployer.initCodeHash(manager, executor, recipient, surchargePpm);
        for (uint256 nonce; nonce < 1_000_000; ++nonce) {
            salt = bytes32(nonce);
            if (hookDeployer.hasExpectedPermissions(
                    hookDeployer.predictFromInitCodeHash(salt, initCodeHash)
                )) {
                return salt;
            }
        }
        revert("salt not found");
    }
}
