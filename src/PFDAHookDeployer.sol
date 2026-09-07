// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IFeeDiscountEligibility} from "./interfaces/IFeeDiscountEligibility.sol";
import {PFDAFeeHook} from "./PFDAFeeHook.sol";

/// @notice CREATE2 deployer for PFDAFeeHook, whose low address bits encode v4 hook permissions.
/// @dev Salts are mined off-chain by the deployment script; this contract never loops on-chain.
contract PFDAHookDeployer {
    uint160 public constant ALL_HOOK_MASK = uint160((1 << 14) - 1);
    uint160 public constant REQUIRED_FLAGS =
        Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG;

    error InvalidHookAddress(address candidate);
    error UnexpectedHookAddress(address actual, address expected);

    event HookDeployed(address indexed hook, bytes32 indexed salt, address indexed eligibility);

    function deploy(
        bytes32 salt,
        IPoolManager manager,
        IFeeDiscountEligibility eligibility,
        address recipient,
        uint24 surchargePpm
    ) external returns (PFDAFeeHook hook) {
        address expected = predict(salt, manager, eligibility, recipient, surchargePpm);
        if (!hasExpectedPermissions(expected)) revert InvalidHookAddress(expected);

        hook = new PFDAFeeHook{salt: salt}(manager, eligibility, recipient, surchargePpm);
        if (address(hook) != expected) revert UnexpectedHookAddress(address(hook), expected);
        emit HookDeployed(address(hook), salt, address(eligibility));
    }

    function predict(
        bytes32 salt,
        IPoolManager manager,
        IFeeDiscountEligibility eligibility,
        address recipient,
        uint24 surchargePpm
    ) public view returns (address) {
        return predictFromInitCodeHash(
            salt, initCodeHash(manager, eligibility, recipient, surchargePpm)
        );
    }

    function initCodeHash(
        IPoolManager manager,
        IFeeDiscountEligibility eligibility,
        address recipient,
        uint24 surchargePpm
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                type(PFDAFeeHook).creationCode,
                abi.encode(manager, eligibility, recipient, surchargePpm)
            )
        );
    }

    function predictFromInitCodeHash(bytes32 salt, bytes32 creationHash)
        public
        view
        returns (address)
    {
        return address(
            uint160(
                uint256(
                    keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, creationHash))
                )
            )
        );
    }

    function hasExpectedPermissions(address candidate) public pure returns (bool) {
        return uint160(candidate) & ALL_HOOK_MASK == REQUIRED_FLAGS;
    }
}
