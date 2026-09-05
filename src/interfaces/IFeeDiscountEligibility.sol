// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PoolId} from "v4-core/src/types/PoolId.sol";

/// @notice Eligibility is for the PoolManager caller (executor), not tx.origin or user-supplied data.
/// @dev Must return a stable answer throughout a swap. An eligible executor must authenticate users.
interface IFeeDiscountEligibility {
    function isEligible(PoolId poolId, address executor) external view returns (bool);
}
