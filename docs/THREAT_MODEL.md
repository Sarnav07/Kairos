# Threat model

## Scope and release boundary

Kairos is a testnet prototype. This threat model covers the sealed-auction stack (`PFDAAuction`, `PFDAExecutor`, and `PFDAFeeHook`) and the separately deployed future Harberger stack (`HarbergerFeeLease` and `HarbergerExecutor`). It is not an audit, does not establish economic safety, and must not be used to represent either stack as production-ready.

The on-chain source of truth is contract state plus finalized chain logs. The frontend, dashboard, event indexer, public RPC endpoint, explorer, and local secret vault are untrusted convenience layers: their failure must never change entitlement or redirect contract funds.

## Assets and security properties

| Asset or property | Required protection |
| --- | --- |
| Bidder funds and refund claims | Exact ERC-20 accounting, pull withdrawals, no privileged withdrawal path. |
| Auction allocation | Commitment must bind chain, auction, bidder, amount, and salt; highest valid funded reveal wins with deterministic ties. |
| Waiver right | Only the current active winner/lease holder may receive it, scoped to the configured pool and one authenticated executor call. |
| Hook surcharge | Never waive LP or native protocol fees; ordinary traders remain able to swap and pay the application surcharge. |
| Deployer proceeds and lease rent | Immutable recipient; no frontend or operator recipient override. |
| Bid secret | Never send or log it before reveal; recovery data remains encrypted client-side. |
| Release evidence | Only verified receipt, bytecode, and immutable-wiring checks may enter the address manifest. |

## Adversaries, controls, and residual risk

| Threat | Existing controls | Residual risk / release requirement |
| --- | --- | --- |
| Commitment copying or cross-auction replay | Domain-bound hash includes chain ID, auction contract, auction ID, bidder, amount, and salt. | A user who leaks the salt can still lose privacy; communicate secret handling. |
| Non-reveal / strategic bidding | Fixed bond and funded reveal; deterministic finalization. | The bond is not bid-sized; economic behavior needs testnet observation. |
| Caller or hook-data spoofing | Executor fixes payer to caller, authenticates the callback, validates pool/hook wiring, and clears eligibility before settlement. | Only exact-input ERC-20 swaps are supported; audit v4 integration before mainnet. |
| Reentrancy or transfer denial | Reentrancy guards, SafeERC20, exact-balance deposit checks, and pull credits. | Non-standard/rebasing/taxed tokens are deliberately unsupported. |
| Auction schedule abuse | Immutable deployer schedules fixed windows; on-chain overlap and minimum-activation checks. | Deployer key is a trust assumption and needs operational key management. |
| Lease default or stale waiver | `activeHolder` derives solvency from time/collateral; grace is cure-only; stateful invariant tests cover insolvent eligibility. | Lease mode needs separate deployment, rehearsal, and audit. |
| RPC/indexer outage or reorg | UI treats indexer data as advisory; reorg-aware indexer replays finalized blocks; direct contract reads remain authoritative. | Do not automate fund movement or rights changes from an indexer. |
| Compromised frontend/build supply chain | Reproducible lockfile install, CI gates, immutable address registry, wallet-confirmed writes. | Pin review dependencies and use an independent deployment verification before release. |
| Deployer-key compromise | No upgrade/admin fund-drain function exists, but the deployer can schedule future auctions and receive proceeds. | Use a dedicated controlled signer; document key rotation as a redeployment migration, not an in-place change. |

## Explicit non-goals

- No native protocol-fee or LP-fee waiver.
- No promise of fair ordering, MEV resistance, bidder profitability, welfare, liquidity, or revenue outcomes.
- No support for native currency, exact-output swaps, partial fills, exotic ERC-20 behavior, proxy upgrades, delegated lease holders, or mutable governance.
- No on-chain pause, emergency upgrade, or administrator override. Adding one is a new protocol design requiring a fresh threat model, audit scope, deployment, and user approval.

## Security review evidence required before a production claim

1. Freeze a commit hash, compiler/toolchain versions, dependency SHAs, deployment bytecode, and constructor arguments.
2. Run formatter, build, deterministic tests, fuzz tests, invariants, frontend lint/tests/build, and the production-readiness verifier from a clean checkout.
3. Have an independent reviewer inspect accounting, callback authentication, hook permission bits, ERC-20 behavior, timing boundaries, and lease transition rules against this document.
4. Complete the testnet soak criteria in [PRODUCTION.md](PRODUCTION.md) with receipt links and an incident log.
5. Obtain an external smart-contract audit for the exact frozen commit and resolve or explicitly accept every finding before any mainnet deployment.
