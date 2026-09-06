// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {IFeeDiscountEligibility} from "./interfaces/IFeeDiscountEligibility.sol";
import {PFDAAuction} from "./PFDAAuction.sol";
import {PFDAFeeHook} from "./PFDAFeeHook.sol";

/// @notice Single-pool exact-input execution with auction-authenticated, transaction-scoped eligibility.
contract PFDAExecutor is IFeeDiscountEligibility, IUnlockCallback, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;

    struct Request {
        address payer;
        PoolKey key;
        SwapParams params;
        uint256 minimumOutput;
        bool discounted;
    }

    IPoolManager public immutable manager;
    PFDAAuction public immutable auction;
    bytes32 private expectedCallback;
    PoolId private currentPool;
    bool private discountActive;

    error InvalidConfiguration();
    error WrongPool();
    error WrongHook();
    error UnsupportedSwap();
    error DeadlineExpired();
    error InvalidCallback();
    error UnexpectedDelta();
    error InsufficientOutput();
    error IncorrectSettlement();

    event SwapExecuted(
        uint256 indexed auctionId,
        address indexed bidder,
        PoolId indexed poolId,
        bool discounted,
        uint256 output
    );

    constructor(IPoolManager manager_, PFDAAuction auction_) {
        if (address(manager_).code.length == 0 || address(auction_).code.length == 0) {
            revert InvalidConfiguration();
        }
        manager = manager_;
        auction = auction_;
    }

    /// @notice All traders may swap; only the active winning caller receives the surcharge waiver.
    /// @dev Payer and output recipient are always msg.sender. No user-supplied identity or hookData.
    function swap(
        uint256 auctionId,
        PoolKey calldata key,
        SwapParams calldata params,
        uint256 minimumOutput,
        uint256 deadline
    ) external nonReentrant returns (uint256 output) {
        // Chain timestamp is intentionally used for the user's execution deadline.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (
            params.amountSpecified >= 0 || params.amountSpecified < -int256(type(int128).max)
                || minimumOutput == 0 || Currency.unwrap(key.currency0) == address(0)
                || Currency.unwrap(key.currency1) == address(0)
        ) revert UnsupportedSwap();
        if (PoolId.unwrap(auction.getAuction(auctionId).poolId) != PoolId.unwrap(key.toId())) {
            revert WrongPool();
        }
        PFDAFeeHook hook = PFDAFeeHook(address(key.hooks));
        if (
            address(hook.manager()) != address(manager)
                || address(hook.eligibility()) != address(this)
        ) revert WrongHook();
        bool discounted = auction.activeWinner(auctionId) == msg.sender;
        bytes memory data = abi.encode(Request(msg.sender, key, params, minimumOutput, discounted));
        expectedCallback = keccak256(data);
        output = abi.decode(manager.unlock(data), (uint256));
        if (expectedCallback != bytes32(0) || discountActive) revert InvalidCallback();
        emit SwapExecuted(auctionId, msg.sender, key.toId(), discounted, output);
    }

    function isEligible(PoolId poolId, address executor) external view returns (bool) {
        return executor == address(this) && discountActive
            && PoolId.unwrap(currentPool) == PoolId.unwrap(poolId);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (
            msg.sender != address(manager) || expectedCallback == bytes32(0)
                || keccak256(data) != expectedCallback
        ) revert InvalidCallback();
        expectedCallback = bytes32(0); // The manager may consume this request exactly once.
        Request memory request = abi.decode(data, (Request));
        currentPool = request.key.toId();
        discountActive = request.discounted;
        BalanceDelta delta = manager.swap(request.key, request.params, "");
        discountActive = false;
        currentPool = PoolId.wrap(bytes32(0));

        int256 inputDelta = request.params.zeroForOne ? delta.amount0() : delta.amount1();
        int256 outputDelta = request.params.zeroForOne ? delta.amount1() : delta.amount0();
        if (inputDelta != request.params.amountSpecified || outputDelta < 0) {
            revert UnexpectedDelta();
        }
        // Checked non-negative above; input was bounded at the authenticated entry point.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint256 output = uint256(outputDelta);
        if (output < request.minimumOutput) revert InsufficientOutput();
        Currency input = request.params.zeroForOne ? request.key.currency0 : request.key.currency1;
        Currency outputCurrency =
            request.params.zeroForOne ? request.key.currency1 : request.key.currency0;
        // inputDelta equals the bounded negative amountSpecified, so negation is positive and safe.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint256 amount = uint256(-inputDelta);
        manager.sync(input);
        IERC20(Currency.unwrap(input)).safeTransferFrom(request.payer, address(manager), amount);
        if (manager.settle() != amount) revert IncorrectSettlement();
        manager.take(outputCurrency, request.payer, output);
        return abi.encode(output);
    }
}
