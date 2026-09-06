# Chunk 2: sealed first-price auction

## Implemented scope

`src/PFDAAuction.sol` implements fixed-window auctions using one immutable ERC-20 bid token. The deploying address is both the auction scheduler and the proceeds recipient. It cannot change a created auction's parameters, withdraw bidder liabilities, or redirect proceeds. Deploy directly from the intended wallet: deployment through a factory would make the factory the recipient.

MockUSDC is the intended demo token. The contract uses OpenZeppelin SafeERC20 and ReentrancyGuard from the already pinned v5.2.0 dependency. No additional dependencies were required.

`activeWinner(auctionId)` returns a winning bidder; it is not the hook's executor eligibility interface. Chunk 3 now supplies PFDAExecutor to validate pool/auction correspondence and authenticate the bidder's execution path before granting a waiver. See EXECUTION.md.

## Schedule and auction rules

The deployer creates each auction with a pool ID, fixed commitment bond, minimum bid and five timestamps. Times are chain timestamp seconds, not wall-clock timers in the frontend or block counts. The constructor fixes a positive minimum activation delay. Test fixtures use 60 seconds; production/demo deployment parameters are not yet selected.

| Interval | Allowed action |
| --- | --- |
| Before commitStart | Inspect terms; no bids |
| [commitStart, commitEnd) | One commitment per bidder with a fixed bond deposit |
| [commitEnd, revealEnd) | Reveal a valid committed bid and fund its full amount |
| [revealEnd, activation) | Anyone can finalize; refunds and proceeds then become claimable |
| [activation, expiry) | Winner is active only if finalized on time with at least one valid reveal |
| At/after expiry | The right is inactive; unclaimed refunds remain withdrawable |

The highest valid revealed bid wins and pays its own amount. Equal bids favor the earlier onchain commitment, regardless of reveal order. The bond is separate from the bid and is returned to every successful revealer, including the winner. Bid amounts and bonds are uint128 token atomic units; a six-decimal token represents 100 units as 100,000,000.

Trading windows for the same pool cannot overlap. They must be scheduled in chronological order, although bidding periods may overlap. Different pools can run concurrent auctions. Cancelled windows remain reserved in this scheduling model; there is no administrative rescheduling/cancellation path.

## Commitment construction and privacy

Use Solidity ABI encoding, not packed encoding:

```solidity
keccak256(abi.encode(chainId, auctionContract, auctionId, bidder, uint128(bidAmount), bytes32(salt)))
```

The contract exposes `commitmentHash` for matching client-side computations. Generate a fresh cryptographically random 32-byte salt locally, save a recovery copy and reveal only in the reveal phase. Never put real salts in Git, analytics or frontend server logs. Test salts in this repository are deterministic fixtures only.

The commit transaction reveals participation and a fixed bond, but not the bid amount. At reveal, both amount and salt become public, and the contract transfers the full bid into escrow. Unfunded/invalid reveals revert atomically and can be retried before revealEnd.

This is bond-backed participation, not a fully collateralized commitment. A bidder can choose to lose the bond rather than reveal an unfavorable bid. Multiple identities/commitments and selective non-reveal remain economic limitations. The fixed bond reduces that incentive but does not prove truthful bidding, Sybil resistance or censorship resistance. The application must display that trade-off and the non-reveal penalty before commit.

## Finalization and cancellation

Finalization is permissionless and cannot run before revealEnd. Successful finalization must occur strictly before activation; activation and expiry never shift with finalization time. The delay is measured from revealEnd, when the highest valid bid is already observable, rather than from the finalization transaction.

No valid reveals, or finalization at/after activation, cancels the right. In a late cancellation, all revealed bids and bonds are refundable. Unrevealed bonds are forfeited even when finalization is late. The stored candidate winner and bid remain available for inspection, but `cancelled` and `activeWinner` determine whether any right was sold.

The UI/runner must submit finalization ahead of activation. A network outage, censorship or unattended auction can cause cancellation; this implementation does not guarantee timely inclusion. If not yet finalized, `phase` returns AwaitingFinalization even after the window has passed, because settlement is still needed. Anyone can finalize later to unlock claims.

## Funds and withdrawals

| Participant/outcome | Refund after finalization | Amount allocated to deployer |
| --- | --- | --- |
| Revealed loser | Bond + full bid | 0 |
| Successful winner | Bond | Winning bid |
| Revealer in cancelled auction | Bond + full bid | 0 |
| Non-revealer | 0 | Bond |

`withdrawRefund(id)` pays only the caller's claim, once. Anyone can trigger `collectProceeds()`, but payment always goes to the deploying address. Proceeds combine winning bids and forfeited bonds; events identify the auction allocations. Swap-hook surcharges are a separate balance flow covered in FEE_ACCOUNTING.md.

The contract maintains `totalRefundable` and `treasuryCredit`. For supported tokens with no unsolicited transfers:

```text
token balance of auction = totalRefundable + treasuryCredit
```

Finalization reallocates liabilities without transferring tokens or iterating over bidders. Claims reduce liabilities before external transfers, use reentrancy protection and roll back if transfers fail. Incoming deposits must increase the contract balance by exactly the expected amount. Fee-on-transfer deposits are rejected. Rebasing tokens and tokens that change transfer behavior after deposit are unsupported. Unsolicited token transfers are not liabilities and have no recovery function in this MVP.

## Verification

- Deterministic lifecycle tests: timestamps, ties, minimum bid, malformed/repeated reveals, copied commitments, domain binding, unfunded deposits, duplicate claims, cancellation/no bids and simultaneous auction accounting.
- Fuzzed two-bidder outcomes and exact final entitlements, 256 cases.
- Stateful invariants: 128 sequences of depth 64, checking balance/liability equality, conservation and an independent highest-bid model. The handler intentionally tolerates rejected actions to explore invalid ordering. Each run ends by finalizing and claiming all funds and checking every bidder's final entitlement.
- Token fault injection: fee-on-transfer rejection, reentrancy during deposits/proceeds, and retryable failed refund/proceeds transfers.
- Existing v4 accounting and MockUSDC tests remain in the full regression suite.

```sh
forge fmt --check
forge build
forge test -vv
```

No public deployment or live auction has occurred. Financial accounting tests do not establish profitable auction economics; that requires the later scenario runner.
