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

Next: chunk 2, sealed first-price auction with ERC-20 escrow and explicit reveal/refund/proceeds rules.
