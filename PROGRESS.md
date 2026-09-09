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

## Chunk 4: local demo workstation and scenario runner

- Added a responsive React/Vite workstation in `app/` for the sealed first-price auction. The interface has an auction clock ribbon, bid preparation flow, lifecycle controls, a local receipt ledger and a deployment-boundary checklist.
- Bid secrets use the same domain fields as `PFDAAuction.commitmentFor`: chain ID, auction address, auction ID, bidder, USDC amount and bytes32 salt. The UI exports a recovery JSON file, revalidates its commitment on import, and explains why it is necessary before a reveal.
- Added a deterministic fee comparison runner. It labels all values as a simplified simulation, preserves the 25 bp LP fee in both paths, and removes only the 5 bp application surcharge for the active winner. It excludes price impact, routing, gas, native protocol fees and token edge cases.
- Added Vitest checks for secret domain binding/tamper detection and fee-model treatment. The app has no wallet connection, contract calls, testnet address, or claimed on-chain receipt yet; its placeholder addresses and receipts are local-only by design.
- Verification: `npm run lint`, `npm run test` (3 tests), and `npm run build` all pass. `forge fmt --check`, `forge build`, and the complete Foundry regression suite all pass: 70 tests with no failures/skips, including the 128-run/64-depth auction invariants. Foundry still reports the known non-fatal sandbox cache warning. No GitHub remote is configured.

## Chunk 5: Unichain Sepolia deployment preflight

- Added `PFDAHookDeployer`, a CREATE2 factory that deploys `PFDAFeeHook` only when its low 14 address bits match the three permissions the hook implements: `beforeSwap`, `afterSwap`, and `beforeSwapReturnDelta`.
- Added `script/DeployPFDA.s.sol`. It requires chain ID 1301, confirms the selected PoolManager has code, deploys MockUSDC/Auction/Executor/HookDeployer, mines the hook salt locally, and derives both the immutable auction proceeds recipient and hook recipient from `DEPLOYER_PRIVATE_KEY`.
- Verified the current official Unichain Sepolia PoolManager at `0x00b036b58a818b1bc34d502d3fe730db729e62ac`: the RPC reports chain ID 1301 and the address has deployed code. The source and broadcast procedure are in docs/TESTNET.md.
- Added tests for predicted CREATE2 deployment, exact permission bits, immutable wiring and invalid-salt rejection. Public deployment and two-bidder on-chain rehearsal are intentionally not claimed: this workspace has no `.env` or funded signer configured. The user must run the documented local broadcast command; no private key should be placed in chat.
- Deployment signer configured by user as `0x54560095593B57Ad71572336037435Ff1E50E4EA`. The script now verifies the locally supplied key derives to this public address before broadcasting, ensuring it is also the immutable auction-proceeds and hook-surcharge recipient.
- Broadcast and independently verified on Unichain Sepolia on 2026-09-09 in block `62101285`. The complete public address and transaction record is committed in `deployments/unichain-sepolia.json`; all five deployment transactions have successful receipts and non-empty bytecode. RPC calls confirmed the auction token and proceeds recipient plus the executor/hook manager, auction, eligibility, recipient and 500-PPM surcharge wiring.

## Chunk 6: submission package and regression gate

- Added a judge-facing README code map with direct contract line anchors, an explicit limitations document, a three-minute demo recording script, and a submission checklist that separates local evidence from account-bound/public work still pending.
- Extended GitHub Actions to verify the React demo (`npm ci`, lint, test and build) after the Foundry checks.
- Added `tools/verify-clean-checkout.sh`, which clones the current repository with submodules into a temporary directory and runs both contract and frontend gates without mutating the working checkout.
- `FEEDBACK.md` now records the actual submission state. No public remote, testnet evidence, demo video, or feedback-form submission is claimed. These remain explicit release blockers rather than substituted local assertions.
- Fresh-checkout verification completed on 2026-09-08: recursive submodules initialized from pinned commits; Foundry formatting/build and all 72 tests passed; a clean `npm ci` then frontend lint, 3 tests and production build passed. The temporary checkout was removed after the run.
