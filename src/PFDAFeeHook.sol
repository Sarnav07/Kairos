// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, toBeforeSwapDelta} from "v4-core/src/types/BeforeSwapDelta.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {IFeeDiscountEligibility} from "./interfaces/IFeeDiscountEligibility.sol";

/// @notice PFDA accounting prototype: waive an application surcharge while preserving v4 LP fees.
/// @dev Supports fully filled exact-input ERC-20 swaps only. Not a native protocol-fee exemption.
///      Auction-backed eligibility and a winner-authenticating executor are separate dependencies.
contract PFDAFeeHook {
    using PoolIdLibrary for PoolKey;

    uint256 public constant FEE_DENOMINATOR = 1_000_000;
    uint24 public constant MAX_SURCHARGE_PPM = 10_000; // 1% prototype safety bound

    IPoolManager public immutable manager;
    IFeeDiscountEligibility public immutable eligibility;
    address public immutable recipient;
    uint24 public immutable surchargePpm;

    error OnlyPoolManager();
    error InvalidConfiguration();
    error UnsupportedSwap();
    error PartialFill();

    event SurchargeCollected(
        PoolId indexed poolId, address indexed executor, address indexed currency, uint256 amount
    );

    constructor(
        IPoolManager manager_,
        IFeeDiscountEligibility eligibility_,
        address recipient_,
        uint24 surchargePpm_
    ) {
        if (
            address(manager_) == address(0) || address(eligibility_) == address(0)
                || recipient_ == address(0) || surchargePpm_ > MAX_SURCHARGE_PPM
        ) revert InvalidConfiguration();
        manager = manager_;
        eligibility = eligibility_;
        recipient = recipient_;
        surchargePpm = surchargePpm_;
        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());
    }

    modifier onlyPoolManager() {
        if (msg.sender != address(manager)) revert OnlyPoolManager();
        _;
    }

    function getHookPermissions() public pure returns (Hooks.Permissions memory permissions) {
        permissions.beforeSwap = true;
        permissions.afterSwap = true;
        permissions.beforeSwapReturnDelta = true;
    }

    function beforeSwap(
        address executor,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata
    ) external onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        if (
            params.amountSpecified >= 0 || params.amountSpecified < -int256(type(int128).max)
                || Currency.unwrap(key.currency0) == address(0)
                || Currency.unwrap(key.currency1) == address(0)
        ) revert UnsupportedSwap();

        uint256 charge = _charge(key, executor, uint256(-params.amountSpecified));
        if (charge != 0) {
            Currency input = params.zeroForOne ? key.currency0 : key.currency1;
            // PoolManager.take creates our debt; the returned positive hook delta offsets it.
            manager.take(input, recipient, charge);
            emit SurchargeCollected(key.toId(), executor, Currency.unwrap(input), charge);
        }

        // Bounded by the int128 input limit and surcharge <= 1%.
        // forge-lint: disable-next-line(unsafe-typecast)
        return (IHooks.beforeSwap.selector, toBeforeSwapDelta(int128(int256(charge)), 0), 0);
    }

    function afterSwap(
        address executor,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) external view onlyPoolManager returns (bytes4, int128) {
        uint256 grossInput = uint256(-params.amountSpecified);
        uint256 netInput = grossInput - _charge(key, executor, grossInput);
        int256 consumedInput = -int256(params.zeroForOne ? delta.amount0() : delta.amount1());
        // Reverting rolls back the surcharge transfer as well as the pool swap.
        // The short-circuit sign check makes the uint256 conversion safe.
        // forge-lint: disable-next-line(unsafe-typecast)
        if (consumedInput < 0 || uint256(consumedInput) != netInput) revert PartialFill();
        return (IHooks.afterSwap.selector, 0);
    }

    function _charge(PoolKey calldata key, address executor, uint256 grossInput)
        internal
        view
        returns (uint256)
    {
        if (eligibility.isEligible(key.toId(), executor)) return 0;
        return grossInput * surchargePpm / FEE_DENOMINATOR;
    }
}
