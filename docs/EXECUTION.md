# Chunk 3: auction-authenticated v4 execution

## Result

`PFDAExecutor` connects the sealed auction's active winning bidder to the real v4 hook. The executor also implements `IFeeDiscountEligibility`, so there is no separate mutable winner registry. End-to-end tests deploy real auction, executor, hook and v4 PoolManager contracts together; eligibility is no longer a fixture in those tests.

The original fee-accounting fixture tests remain useful regression tests, but their public test router is not the winner execution path.

## Wiring

1. Deploy PFDAAuction directly from the intended proceeds-receiving wallet, with MockUSDC and the chosen minimum delay.
2. Deploy PFDAExecutor with the real PoolManager and that auction address.
3. Deploy PFDAFeeHook at a valid hook address, setting eligibility to PFDAExecutor and recipient to the intended deploying wallet.
4. Initialize a pool with that hook. Create auctions using its complete PoolKey-derived pool ID.

The executor does not need the hook address in its constructor. At swap entry it verifies the supplied pool ID against the auction, and checks the hook's manager/eligibility wiring. The auction scheduler is responsible for selecting the intended hook code and pool. These getter checks validate wiring, not arbitrary hook bytecode. Neither the auction's configured address nor the executor's manager can be changed.

## Authenticated request

```solidity
executor.swap(auctionId, poolKey, swapParams, minimumOutput, deadline)
```

Payer and output recipient are the caller. There is no payer argument, arbitrary output recipient, forwarded identity, signature scheme or user-supplied hookData. Each caller approves only its input token to the executor. A caller may be an EOA or contract; a proxy's caller identity is the proxy itself, not tx.origin.

The entry point checks deadline, exact-input bounds, nonzero minimumOutput, ERC-20 currencies, auction/pool equality and hook wiring. It compares `auction.activeWinner(auctionId)` to msg.sender. Ordinary traders are allowed; they simply do not receive the surcharge waiver.

## Callback and discount lifetime

The executor builds a request containing the authenticated payer, pool, swap parameters, minimum output and eligibility result. It records the request hash before calling PoolManager.unlock. The callback accepts exactly that request, exactly once, from the immutable PoolManager. Direct calls, idle manager callbacks and modified payloads cannot establish a request.

During manager.swap, eligibility is true only when all three conditions hold:

- The actual PoolManager caller queried by the hook is this executor.
- The queried pool is the current authenticated request's pool.
- The request was initiated by that auction's active winning bidder.

The hook's existing beforeSwap/afterSwap logic sees the same answer throughout the swap. After manager.swap returns, the executor clears eligibility and the pool context before token settlement. Reentrant public swaps are blocked, and a failed transaction rolls back the entire context.

The executor checks that the input delta exactly matches the specified input, and output meets minimumOutput. It then syncs the input currency, transfers input directly from the caller to PoolManager, checks the settled amount, and takes output directly to the caller. It never spends another bidder's approval and does not retain user input/output tokens in the normal flow.

## Time windows and ordinary access

Before activation, at/after expiry, or for an unfinalized/cancelled auction, no bidder has a discount. Ordinary swaps still work through either the executor or another compatible v4 router. Using an expired auction ID does not automatically select a newer auction; the client must use the appropriate current ID. Equal pools have non-overlapping auction rights windows as enforced by PFDAAuction.

A winning bidder using an ordinary router still pays the surcharge because that router cannot authenticate itself as this executor. Forged hookData and tx.origin do not affect eligibility. Direct discounted routing through aggregators or delegated executors is outside this MVP.

## Evidence

`test/PFDAIntegration.t.sol` covers:

- A funded two-bidder auction, finalization, winner/loser swaps and deployer receipt of auction proceeds.
- Fuzzed input amounts in both directions, comparing identical pool snapshots. The winner gets more output for equal gross input; the loser pays the exact surcharge; LP fee configuration remains unchanged.
- Activation and expiry boundaries, winner-to-loser isolation, new-winner handover and stale auction IDs.
- Other pools, cancelled/unfinalized auctions and incompatible hook/manager wiring.
- Forged hookData, a proxy called by the winner, unauthorized callbacks and winner-allowance isolation.
- Deadline, minimum-output, oversized/exact-output input and partial-fill rejection.
- Atomic rollback on missing approvals/slippage failure and successful later execution.
- Reentry during token settlement is rejected and eligibility is already cleared.
- Native protocol fees remain payable by the winner.

## Limits

This implements the application surcharge waiver described in FEE_ACCOUNTING.md; it does not waive native protocol fees or establish the paper's economic return predictions. The supported path remains a fully filled, single-pool, exact-input swap with ordinary non-rebasing ERC-20 tokens. Minimum-output checking uses the manager delta; taxed/rebasing output tokens are unsupported. Deadlines use chain timestamps, with equality allowed.

Tests deploy hook code to a valid address using Foundry. A public deployment still needs CREATE2 hook-address mining, pinned deployed-manager verification, testnet gas, wallet signing, and deployment evidence in chunk 5. No public network transaction occurred in this chunk.

## Reproduce

```sh
forge fmt --check
forge build
forge test --match-contract PFDAIntegrationTest -vv
forge test --summary
```
