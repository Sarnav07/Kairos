# Chunk 15: proposed Harberger fee-right lease

## Status and decision boundary

This is a written design, not deployed or executable lease code. It proposes an alternative allocation mode for the application-level surcharge waiver in [FEE_ACCOUNTING.md](FEE_ACCOUNTING.md). It does not alter the deployed sealed-auction contracts, pool, hook, executor, addresses, or evidence register.

Chunk 16 must not begin until the project owner approves the decisions in [Approval gate](#approval-gate). A Harberger lease is a materially different financial product from the sealed first-price auction: the holder continuously self-prices the right, pays rent, and can lose it through takeover or insolvency.

## Objective and immutable terms

The right is only the existing application-surcharge waiver for one immutable PoolId. It is not ownership of the pool, LP fees, native protocol fees, the bid token, trader order flow, or a routing monopoly. Ordinary swaps remain available. A holder receives the waiver only through a new executor that verifies the current active holder.

Each lease source fixes these terms at deployment. No owner, deployer, operator, or governance role may change them. Changing a token, rate, pool, recipient, or timing rule requires a new source and executor deployment.

| Term | Symbol | Rule |
| --- | --- | --- |
| Bid/rent token | T | One standard, non-rebasing ERC-20. |
| Rent rate | r | Positive basis points per year on self-assessed valuation. |
| Minimum valuation | Vmin | Positive token amount. |
| Settlement interval | I | Positive monitoring/prepayment duration; rent still accrues pro rata. |
| Grace period | G | Positive post-insolvency cure window. |
| Minimum prepay | P | Positive duration, proposed as I; acquisitions, valuation changes, and cures must cover it. |
| Rent recipient | R | Immutable deployer-recipient, matching the current auction proceeds rule. |

## State and accounting

For pool p, the lease holds:

~~~
holder[p]                 self-assessing address, or address(0)
valuation[p] = V          declared value in token atomic units
collateral[p] = C         refundable prepaid token balance
lastSettled[p] = S        timestamp through which rent was settled
rentRemainder[p] = M      numerator remainder carried between settlements
insolventAt[p]            first time collateral stops covering rent, or 0
arrears[p]                accrued but unpaid rent after a recognized default
~~~

It separately tracks rentCredit[R], refundCredit[account], and takeoverCredit[account]. State-changing transitions credit liabilities rather than transfer tokens to an untrusted receiver. Holders and R withdraw their own credits later, so a rejecting receiver cannot freeze takeover, release, settlement, or liquidation.

At every accounting transition, the invariant is:

~~~
token balance of lease source
  = sum(collateral by pool) + rentCredit + sum(refundCredit) + sum(takeoverCredit)
~~~

Unsolicited transfers are not liabilities. Fee-on-transfer, rebasing, taxed, callback, and other non-standard bid tokens are unsupported; every deposit must increase the source balance by exactly the expected amount.

## Rent and solvency

Rent accrues continuously. Let Y be 31,536,000 seconds and B be 10,000 basis points. For elapsed seconds delta:

~~~
N = V × r × delta + M
rentDue = floor(N / (B × Y))
nextRemainder = N mod (B × Y)
~~~

Implementation must use full-precision checked multiplication/division. It must reject terms for which one interval's rent rounds to zero:

~~~
floor(Vmin × r × I / (B × Y)) >= 1
minimumPrepay(V) = ceil(V × r × P / (B × Y))
~~~

Settlement is permissionless. If collateral covers rentDue and arrears is zero, it credits rentDue to R, deducts it from collateral, and updates S/M. It never extends the right or forgives arrears.

If collateral does not cover rentDue, settlement credits only the available collateral to R, records the shortfall as arrears, sets collateral to zero, and advances S/M to the settlement timestamp. If this is the first observed shortfall, it records the calculated original solvency boundary in insolventAt; later settlement calls retain that boundary and add any further shortfall to arrears. Arrears are a claim condition, not an asset liability, so they are excluded from the token-balance invariant.

The active-right query derives solvency from timestamp and collateral. It returns the holder only while collateral covers accrued rent; it returns zero immediately once the solvency boundary is crossed. Grace is cure-only: no discounted swap occurs while insolvent.

Every mutating action that needs to decide cure or liquidation calculates that same boundary even when no earlier settlement recorded it. It records the original boundary before applying a cure or liquidation rule, so an unattended default cannot gain a fresh grace period merely because it was observed late.

SolvencyUntil is the largest timestamp t at or after S for which:

~~~
floor((V × r × (t - S) + M) / (B × Y)) <= C
~~~

The implementation must calculate this boundary with the same arithmetic as settlement. A transition that observes insolvency records the original boundary in insolventAt; later calls cannot reset the default clock or reactivate the waiver.

## Lease lifecycle

### Claim a vacant right

When holder[p] is zero, anyone may call claimVacant(pool, V, deposit) with V at least Vmin and deposit at least minimumPrepay(V). The caller becomes holder and starts with no unpaid rent. No payment goes to a prior holder because the right is vacant.

Whether a right begins vacant or comes from a sealed first-price auction is deliberately deferred to the [Approval gate](#approval-gate). Chunk 16 must implement exactly one allocation rule, not mix them.

### Top up, cure, and valuation changes

Only the holder may top up collateral. A top-up does not clear arrears or reactivate a defaulted right. While now is at or before insolventAt plus G, only the recorded holder may cure. Cure calculates additional rent through the cure timestamp and requires a deposit large enough to pay existing arrears, that additional rent, and minimumPrepay(V). It credits the rent to R, clears arrears and insolventAt, and leaves the required collateral atomically.

Only a solvent active holder may set a new valuation. The source settles first, rejects values below Vmin, and requires remaining collateral plus the supplied deposit to meet minimumPrepay(newV). A lower valuation takes effect immediately and immediately becomes the public takeover price.

Only the holder may release. The source settles rent, clears the holder permanently, and credits all remaining collateral to that holder. Accrued rent is never refunded and release preserves no reclaim priority.

### Solvent takeover

Any challenger may call takeOver(pool, newValuation, newDeposit) only while the incumbent is solvent and active. The source settles the incumbent first and requires:

~~~
newValuation >= Vmin
newDeposit >= minimumPrepay(newValuation)
~~~

The challenger deposits two distinct amounts: the incumbent's declared valuation V, credited to the incumbent as takeoverCredit, and newDeposit, stored as its new collateral. The source credits the incumbent's residual collateral as refundCredit, records the challenger/new valuation, resets settlement state, and then exposes the challenger as active.

The price is the incumbent's valuation, not the challenger's new valuation. A visible takeover can be raced in the public mempool; the first valid transaction wins. This prototype makes no MEV-resistance or fair-ordering claim.

### Insolvency and liquidation

At insolvency, activeHolder(pool) returns zero and the waiver stops. The holder alone may cure through insolventAt plus G, inclusive. After that deadline anyone may liquidate(pool).

Liquidation settles and credits all collectible collateral to R, credits any residual collateral to the former holder, clears the holder and valuation, and makes the pool vacant. The first version has no liquidation bounty. A caller may subsequently claim the vacant right through the normal claim flow.

## Executor and hook integration

Chunk 16 requires an isolated right-source interface:

~~~solidity
interface IFeeRightSource {
    function activeHolder(PoolId poolId) external view returns (address);
}
~~~

The lease source implements activeHolder. A new executor version receives that immutable source at construction, validates the pool exactly as the current executor does, and compares activeHolder(poolId) to msg.sender for one swap. It must clear per-swap eligibility before settlement. The hook receives no holder-management logic.

The existing executor hard-codes PFDAAuction and cannot be retrofitted in place. Lease mode needs a distinct lease source, executor, hook deployment, pool initialization, address registry, and rehearsal. No hook may infer eligibility from a caller's valuation or unverified calldata.

## Threat model and non-goals

| Risk | Required treatment |
| --- | --- |
| Stale rent | activeHolder derives solvency from timestamp/collateral, not an operator settlement call. |
| Rounding | Carry a remainder and enforce nonzero minimum interval rent. |
| Takeover/refund denial of service | Credit liabilities, use reentrancy protection, and let recipients withdraw. |
| Token accounting mismatch | Exact incoming-balance checks and the stated liability invariant. |
| Front-running | State the public-mempool risk; do not claim fairness. |
| Insolvent free discount | Return zero holder immediately; grace is cure-only. |
| Config abuse | Terms and recipient are immutable per source. |
| Smart-contract wallets | Keep ordinary ERC-20 approval; optional permits cannot be the only path. |
| Economic claims | Do not claim optimal valuation, welfare, revenue, liquidity, or trader behavior from local tests. |

The first implementation excludes delegated holders, partial ownership, subleases, liquidation rewards, price-oracle valuation, protocol-fee changes, native collateral, upgradeability, pausing, and mutable governance.

## Required Chunk 16 verification

Implementation may start only after approval below, then must add:

- deterministic tests for claim, top-up, valuation change, release, takeover, grace, cure, liquidation, credits, and delayed/failed withdrawals;
- fuzz tests over time, valuations, deposits, rate rounding, and repeated takeovers;
- stateful invariants for token conservation, exact liabilities, one active holder per pool, no discount while insolvent, immutable terms/recipient, and no stale holder after release/liquidation;
- executor/hook integration tests proving only the active lease holder receives the app-surcharge waiver while ordinary traders retain access;
- a complete local lease lifecycle before any testnet broadcast; and
- a separately verified deployment/rehearsal before the app presents lease mode as live.

## Approval gate

The project owner must explicitly approve all five items before Chunk 16:

1. Allocation: vacant-right entry, or a sealed-auction winner as the mandatory first lease holder.
2. Immutable testnet terms: bid token, r, Vmin, I, P, and G.
3. Economics: rent to immutable deployer recipient; full declared value paid to incumbent on takeover; no liquidation bounty.
4. Rights: immediate suspension at insolvency, cure-only grace, and permissionless liquidation after grace.
5. Deployment: a distinct lease source/executor/hook/pool deployment, not a modification or replacement of the current verified stack.

Until all five are approved, this repository has no Harberger lease contract, no lease transaction, no active leased right, and no live lease claim.
