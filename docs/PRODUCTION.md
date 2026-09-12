# Production-hardening and release operations

## Status

This is a release plan and machine-checked documentation gate, not a production certification. The verified Unichain Sepolia auction stack remains testnet-only. The Harberger contracts are local-source tested only and have no deployment, pool, UI, or rehearsal. No on-chain pause, upgrade, or emergency administrator exists.

## Monitoring and event operations

Use the read-only [indexer option](../indexer/README.md) for durable history. Direct contract reads and finalized logs remain authoritative; a stale indexer may hide activity but must never change auction, fee-right, or fund state.

| Signal | Alert condition | Operator response |
| --- | --- | --- |
| Provider consistency | Chain ID, head, or finalized block hash differs across providers | Mark dashboard data stale, stop notifications, investigate provider/reorg state, and replay only from a common ancestor. |
| Indexer lag | Cursor is more than the agreed block/time budget behind finalized head | Disable “fresh” claims in UI, backfill logs, and verify the cursor hash before recovery. |
| Decoder coverage | Unknown topic0 or ABI decode failure for a configured address | Preserve raw log, page the maintainer, add reviewed ABI support, rebuild projections. |
| Auction deadlines | Commit/reveal/finalization/activation/expiry enter the defined warning window | Notify the human operator and affected connected UI only; never auto-submit a transaction. |
| Escrow/liability anomaly | Contract balance disagrees with on-chain accounting view or expected event projection | Treat as a security incident, halt release activity, reproduce from raw logs and direct calls. |
| Lease solvency | Active holder becomes zero, arrears appears, or cure grace is near expiry | Mark the right inactive in the UI, notify only from finalized/direct state, and never auto-cure or liquidate. |
| RPC/write failure | Wallet simulation/revert or provider errors exceed the agreed error budget | Disable affected write affordances and show direct explorer/manual recovery paths. |

## Incident policy without a pause function

The deployed protocol is immutable and has no pause or upgrade authority. This is intentional; operators cannot freeze bidder funds, retroactively change a schedule, or alter a waiver. Therefore, the response boundary is off-chain:

1. Declare severity, preserve transaction hashes, block numbers, UI version, RPC responses, and raw logs; do not delete evidence or edit the deployment manifest.
2. For a suspected frontend/indexer issue, disable new write controls in the hosted UI, display the exact contract/explorer links, and tell users that direct contract state is authoritative.
3. For an on-chain issue, stop new deployments and public promotion. Do not suggest that an existing immutable deployment can be paused or repaired in place.
4. Publish a factual incident notice with scope, user actions, and known impact. Any migration uses a new, independently reviewed deployment; it never silently redirects the existing one.
5. Run a post-incident review covering root cause, evidence, affected funds/rights, remediation, and whether the threat model/audit scope must change.

Adding an on-chain pause, upgrade proxy, guardian, multisig, or circuit breaker is outside this release. It changes the trust model and requires explicit owner approval, a new threat model, full test coverage, and external review before deployment.

## Repeatable release procedure

1. Select a release commit and record its full SHA, clean working-tree status, Solidity version, Foundry version, Node version, dependency submodule SHAs, and `app/package-lock.json` hash.
2. From a fresh recursive clone, run:

   ```sh
   bash tools/verify-production-readiness.sh
   bash tools/verify-clean-checkout.sh
   ```

3. Independently compare compiler output/bytecode and constructor arguments with the intended chain configuration. Check v4 hook permission bits and every immutable relationship: auction token/deployer, executor manager/auction or lease, hook manager/eligibility/recipient/surcharge, and pool hook.
4. Use a dedicated signer with minimal testnet funds. Keep its private key only in local secure storage; never commit it, place it in a ticket, browser vault, logs, or chat.
5. Broadcast one transaction at a time. Wait for receipts, verify chain ID and bytecode, and then add only truthful addresses/hashes to a versioned manifest and [EVIDENCE.md](EVIDENCE.md).
6. Start indexer monitoring from the deployment block, run the soak plan below, and retain raw logs plus an incident log. Do not label the build live before all release gates are met.

## Testnet soak plan

The soak run is **pending**; no result is claimed here. It begins only after a two-bidder public rehearsal has been recorded in [EVIDENCE.md](EVIDENCE.md).

| Stage | Minimum evidence | Pass condition |
| --- | --- | --- |
| Baseline | Frozen commit, addresses, bytecode/immutable checks, two independent RPC heads | Every value matches the release manifest. |
| Seven-day observation | Indexer cursor/history and daily direct-call snapshots | No unreconciled reorg, decoder, balance, or eligibility discrepancy. |
| Auction lifecycle | Two bidder commits/reveals, finalization, refund, and proceeds receipt | Direct state, receipts, and index projection agree. |
| Swap behavior | One active-winner and one ordinary exact-input swap | LP fee remains configured; only the app surcharge differs. |
| Failure drills | RPC failover, indexer restart/backfill, stale UI write preflight | UI marks data stale or rejects writes safely; no automated transactions occur. |
| Lease-only future deployment | Initial claim, rent settlement, takeover, insolvency/cure/liquidation rehearsal | Source, executor, hook, and pool are separately deployed and all transitions agree with direct state. |

Record date, commit, addresses, providers, block ranges, transaction links, direct-call values, alert outcomes, and incidents in a new dated soak entry before changing this status to complete.

## External audit plan and release blockers

The audit target is the exact frozen commit, including Solidity contracts, deployment scripts, hook-address deployment, ABI/indexer assumptions, and the frontend transaction construction. The auditor should explicitly review ERC-20 accounting, timestamp boundaries, commitment privacy, auction finalization/refunds, v4 callback authentication, hook deltas, reentrancy, constructor wiring, and all Harberger rent/takeover/default transitions if lease mode is in scope.

Do not deploy to a production network until all of these are true:

- a written independent-review report covers the frozen commit and all high/critical findings are resolved;
- the external audit scope and remediation report cover the exact bytecode being deployed;
- the repeatable release and completed soak evidence are linked publicly and verified;
- key custody, provider failover, incident contacts, monitoring ownership, and user communication are assigned; and
- the public UI accurately describes testnet/production status, supported assets, fee boundaries, and any unresolved risk.

See [THREAT_MODEL.md](THREAT_MODEL.md) for assets, adversaries, controls, and residual risks.
