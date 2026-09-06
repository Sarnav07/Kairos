# Build progress

## Chunk 0: repository foundation

- Added Foundry configuration (Solidity 0.8.26, Cancun), pinned forge-std v1.9.7 and OpenZeppelin v5.2.0 submodules.
- Added six-decimal, permissionlessly mintable MockUSDC for testnet demonstration only.
- Added token approval/escrow tests and GitHub Actions verification workflow.
- Recorded scope, September 14 deadline, chunk acceptance gates, fee-fidelity correction and Harberger stretch scope.
- Local verification: formatting and build pass; 2 tests pass, 0 fail.
- Foundry emits a non-fatal sandbox warning when saving its global signature cache; it does not affect test execution.
- GitHub CI has not run yet; no remote is configured. No contracts are deployed.

## Chunk 1: real v4 fee accounting

- Pinned unmodified v4 core to `46c6834698c48bc4a463a86d8420f4eb1d7f3b75`.
- Implemented PFDAFeeHook with separate input-token surcharge, immutable recipient, executor eligibility interface, unchanged LP fee rate and full-fill enforcement.
- Compared real hooked and unhooked pools in both directions, including native protocol-fee interaction and randomized input sizes.
- Verification: formatting and build pass; 21 tests pass (19 hook tests plus 2 token tests), including two fuzz tests with 256 runs each.
- Documented exact fee composition, rounding, fixture-only eligibility, and unsupported swap modes in docs/FEE_ACCOUNTING.md.
- No testnet deployment or auction claims. No GitHub remote configured.

## Chunk 2: sealed first-price auction and escrow

- Added PFDAAuction with a domain-bound commitment hash, fixed commitment bond, funded reveals, minimum bid and earliest-commit tie handling.
- Added fixed timestamp windows, non-overlapping rights per pool, permissionless finalization, active-winner query, and late-finalization cancellation.
- Refunds are pull claims. Winning bids and non-reveal bonds accrue to the immutable deploying wallet. Finalization and claims require no bidder loops.
- Added SafeERC20 deposits/withdrawals, exact incoming balance checks, reentrancy protection, and retryable transfer failure tests.
- Verification: formatting and build pass; full regression suite has 50 passing tests and no failures/skips. Auction adds 21 lifecycle/fuzz tests, 5 token-behavior tests and 3 stateful invariants (128 runs, depth 64). Stateful run cleanup verifies all final entitlements and zero remaining owed funds.
- Rules, privacy/collateral trade-offs, cancellation penalties and integration boundaries are documented in docs/AUCTION.md. No public deployment or GitHub push; remote remains unconfigured.

## Chunk 3: auction-authenticated v4 execution

- Added PFDAExecutor, which verifies the auction/pool, identifies the caller as active winner, and implements transaction-scoped hook eligibility without a mutable registry.
- Payer/output recipient are fixed to the caller; callback data is bound to a one-use request hash and the immutable manager. Eligibility clears before token settlement; reentrant swaps are blocked.
- Added deadline/minimum-output checks, exact-input settlement and validation of hook/manager wiring.
- Added 20 integration tests using real auction, executor, hook and v4 core: both directions/random amounts, activation/expiry, loser isolation, pool/auction isolation, stale-ID handover, cancelled auctions, proxy/router spoofing, rollback and reentry.
- Full regression: 70 tests pass, no failures/skips; compilation and formatting pass. Existing 128-run/64-depth auction invariants remain green.
- Documented wiring, caller authentication, ordinary trader access, supported modes and limitations in docs/EXECUTION.md. No public testnet deployment or GitHub remote yet.

Next: chunk 4, wallet UI and repeatable scenario runner, including commitment-secret recovery and transaction receipts.
