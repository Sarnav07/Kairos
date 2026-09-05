// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IFeeDiscountEligibility} from "../../src/interfaces/IFeeDiscountEligibility.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";

/// @dev Test-only fixture. No auctions, permissions, or user authentication. Never deploy this.
contract EligibilityFixture is IFeeDiscountEligibility {
    mapping(PoolId => mapping(address => bool)) public isEligible;

    function setEligible(PoolId poolId, address executor, bool eligible) external {
        isEligible[poolId][executor] = eligible;
    }
}
