// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PoolId} from "v4-core/src/types/PoolId.sol";

/// @notice Immutable-source interface for a currently active application-fee right.
interface IFeeRightSource {
    function activeHolder(PoolId poolId) external view returns (address);
}
