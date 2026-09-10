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

## Chunk 7: pool bootstrap and rehearsal runner

- Added permissionlessly mintable, explicitly valueless `KRA` and `KRB` demo trade tokens and a Unichain Sepolia bootstrap script. The script validates the deployed auction/executor/hook wiring, deploys the token pair and the pinned v4-core test liquidity router, initializes the ordered hook pool at a 1:1 price, and adds concentrated demo liquidity.
- Added a separate scheduling script. It does not contain bidder secrets and does not run automatically; its timing, bid bond and reserve are explicit local configuration that must be reviewed before a public rehearsal.
- Added a real-v4 bootstrap test covering sorted currencies, hook pool initialization, liquidity settlement and the immutable relationship between manager, auction, executor and hook. Local verification is 74 passing tests.
- Broadcast and independently verified the KRA/KRB hook pool in Unichain Sepolia block `62101827`. The public manifest records every contract address and core transaction hash; RPC checks confirmed token metadata, contract bytecode, successful receipts and nonzero seeded token balances at the PoolManager. No auction has been scheduled yet.

## Chunk 8: Unichain wallet runtime

- Added a typed Unichain Sepolia registry with the verified deployed contracts, pool ID, explorer routes, an injected EIP-1193 wallet adapter, chain guard and switch request, and a viem read-only client.
- The workstation now shows disconnected, unavailable, wrong-network and connected wallet states. It verifies the auction → executor → hook immutable wiring live and displays the verification block plus explorer links. It does not create approvals or submit any auction transaction.
- Added frontend tests for the verified registry, explorer routes, chain parsing/guard, wallet hydration and the exact `wallet_switchEthereumChain` request. `npm run lint`, 8 Vitest tests and the production build pass; browser checks confirmed the responsive desktop/mobile runtime. The full Solidity suite remains green with 74 tests.

## Chunks 9–10: encrypted bidder flow and deployer controls

- Added a user-confirmed Unichain Sepolia write client for exact MockUSDC approvals, commitment, reveal, refund and proceeds collection. The UI preflights the connected wallet's balance, allowance, phase and configured auction before opening a wallet confirmation.
- Added a browser-only AES-256-GCM/PBKDF2 secret vault. Records bind their ciphertext to the existing domain-bound secret, require a 12-character password, keep that password out of storage, and reject a decrypted secret for a different connected wallet.
- Added a separate immutable-deployer-gated operator panel. It fixes the deployed KRA/KRB pool, validates positive whole-minute windows and enforces at least a 30-minute post-reveal activation delay before a wallet can create an auction. It also exposes proceeds collection.
- Added 4 focused frontend tests for encrypted vault recovery/tamper isolation and schedule/USDC validation, bringing the frontend suite to 12 tests. No live auction was created during implementation; every state-changing path remains a button click plus wallet confirmation.

## Chunk 11: live auction dashboard and rehearsal evidence

- Added a read-only dashboard for a chosen on-chain auction ID. It shows phase and the next fixed deadline countdown, commitment/reveal counts, winner/right state, winning bid, treasury credit and outstanding refunds.
- Added a transaction-linked activity tape for auction lifecycle events, executor swaps and pool surcharge receipts. The RPC reader uses a bounded recent block window; no permanent indexer or unverified historical claim is implied.
- Added a two-bidder rehearsal checklist derived solely from visible receipts: schedule, two commits, two reveals, finalization/refund/proceeds, plus discounted and ordinary executor swaps.
- Added deterministic dashboard tests for phase deadlines, countdowns and evidence gating, bringing the frontend suite to 14 tests. No live auction or rehearsal transaction was created during this chunk.

## Chunk 12: submission evidence update

- Added a canonical [public evidence register](docs/EVIDENCE.md) with the deployed Unichain Sepolia stack, pool bootstrap receipts, repository and public feedback-file links. It separates those verified links from the intentionally pending auction rehearsal, video and account-bound feedback form.
- Added `tools/verify-submission-evidence.sh`, which checks the evidence manifest invariants, configured GitHub remote, public feedback URL and each currently listed public receipt. It fails if a pending item is silently represented as complete.
- Corrected the stale feedback-file remote statement and updated the judge path and release gate. The script does not submit forms or create transactions; unresolved rehearsal, video and feedback-form evidence remains plainly pending.

## Chunk 13: auction-value calculator

- Added an editable bid worksheet that makes pool-volume, captured-share, surcharge, sealed-bid and gas assumptions visible. It calculates eligible volume, waived-surcharge savings, all-in cost, modelled net value, break-even eligible flow and implied pool volume.
- Added a deterministic half/expected/double-volume sensitivity strip and explicitly labels the calculation as an assumption model rather than a price quote, forecast, execution estimate or guarantee.
- Added focused arithmetic tests for the core formula, unavailable break-even cases, and sensitivity construction, bringing the frontend suite to 17 tests. No wallet action, testnet transaction, or auction claim is created by this feature.
