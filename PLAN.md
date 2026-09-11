# Delivery plan

Target: September 14, 2026; solo builder; Start Fresh. Exact submission cutoff/timezone must be checked in the participant dashboard. Aim to finish the submission package on September 13.

## Workflow

Each chunk ends with appropriate local verification, a review of the staged diff, and a descriptive commit. Push successful commits to the user-provided GitHub remote once available. Never fabricate or backdate history. Record failures and outstanding limitations honestly. No deployment is required to complete local milestones.

## Chunks and acceptance gates

| Chunk | Target | Deliverable | Required evidence | Commit intent |
| --- | --- | --- | --- | --- |
| 0 | Sep 5 | Foundry scaffold, pinned libraries, CI, scope and plan | Build, formatting, meaningful scaffold test | chore: initialize PFDA workspace |
| 1 | Sep 5–6 | Real v4 hook fee feasibility test | Non-winner surcharge reaches recipient; winner waiver preserves LP fee rate; both directions; fee composition explained | feat: prove PFDA hook accounting |
| 2 | Sep 6–7 | MockUSDC and sealed auction | Commit/reveal boundaries, ties, no bids, refunds, proceeds accounting, replay prevention, fuzz invariants | feat: implement sealed first-price auction |
| 3 | Sep 7–8 | Auction rights connected to hook and authenticated execution | No spoofed winner, delayed activation, expiry, ordinary trader access, multi-auction isolation | feat: connect auction rights to swaps |
| 4 | Sep 8–10 | Wallet UI and repeatable scenario runner | Commit-secret export/recovery, reveal, refunds, swap, receipts; baseline comparisons labeled as simulations | feat: add auction demo interface |
| 5 | Sep 10–11 | Testnet deployment and end-to-end rehearsal | Verified contract addresses, signer-derived recipient, two bidders, paid winning bid, swaps and treasury receipt | feat: deploy and verify testnet demo |
| 6 | Sep 11–13 | Submission and regression pass | Fresh checkout reproduction, code permalinks, FEEDBACK.md, video, feedback form, known limitations | docs: prepare hackathon submission |

Dates are targets; accounting correctness takes priority over stretch scope.

## Auction design requirements

- Commitments bind chain ID, auction contract, auction ID, bidder, bid amount, and a cryptographically random salt. The earlier three-field hash sketch omitted necessary identity/domain binding.
- Specify a fixed schedule before bidding: commit close, reveal close, activation, expiry. Late finalization must not silently sell an extended or shifted right.
- Equal bids favor the earliest valid commitment (implemented and tested in chunk 2).
- Explicitly handle zero valid reveals and finalization after expiry.
- Highest valid bidder pays their own bid. Losing deposits remain refundable; proceeds are accounted separately.
- Chunk 2 implements a fixed commitment bond with funding at reveal. This is not complete collateralization during commit: selective non-reveal remains possible at the cost of the bond. The trade-off is documented in docs/AUCTION.md. Bid-sized deposits during commit would leak amounts.
- Chunk 2 fixes timestamp windows before commit and requires finalization before activation. Late finalization cancels the right and refunds revealed bids/bonds; non-reveal bonds are still forfeited. Timing and penalty rules must be visible in the UI.
- Use pull withdrawals and bounded work per operation; no loop over every bidder for settlement.
- Keep the deployer recipient fixed for each auction; no mid-auction recipient or fee changes.
- Prevent router/hookData identity spoofing. Do not use tx.origin for authorization.
- Activation delay reduces some exclusion incentives; it does not guarantee censorship resistance.

## Fee integration gate

Use unmodified v4 core. Keep LP fee rate fixed, account for a separate application hook surcharge, and waive only that surcharge for the active winner. Test native protocol-fee interaction explicitly. If an active native protocol fee prevents the claimed treatment, document it and stop claiming native protocol-fee exemption. Model claims about improved LP returns require measurement and may fail under gas costs, weak bidding competition or different chain timing.

## Stretch: Harberger lease

Keep winner/validity queries independent of the auction implementation where practical. Do not build a generic strategy framework now. Start leasing only after chunk 6 is ready and there is time to test takeover timing, rent solvency, refunds and rights transitions. Otherwise retain it as documented future work.

## External inputs

- GitHub remote URL from the user; local commits can proceed before this arrives.
- Deployment signer via local wallet/keystore and testnet gas when deployment begins. Never request private keys in chat.
- User completes account-bound hackathon/feedback submission steps, with prepared content and links.

## Product expansion roadmap

The original six chunks establish the locally verified MVP and submission package. The following chunks cover every approved product feature. Each one has its own tests, documentation update, review gate, and local commit. A later chunk cannot claim live evidence until the earlier deployment gate has actually completed.

### Critical path for the September 14 submission

With the September 14 deadline, the credible hackathon path is chunks 7–11 plus the final evidence update: live testnet infrastructure, wallet flows, operator flow, event dashboard, and a recorded two-bidder rehearsal. Permit abstraction and Harberger leasing are post-submission work because they change financial authorization and rights-allocation semantics and need separate review. The local simulator remains available if an external testnet dependency fails.

| Chunk | Scope | Core deliverable | Acceptance gate | Commit intent |
| --- | --- | --- | --- | --- |
| 7 | Testnet bootstrap | Deployable mock trade pair, pool initializer/liquidity seeder, auction schedule helper, deployment manifest schema | Local real-v4 bootstrap test; all addresses/config validated; no fabricated manifest | `feat: add testnet pool bootstrap` |
| 8 | Wallet runtime | Unichain Sepolia connection, network guard, address registry, read-only contract client and explorer links | UI build; address/chain validation unit tests; disconnected and wrong-network states | `feat: add Unichain wallet runtime` |
| 9 | Bidder flow + vault | Allowance, commit, reveal and refund transactions; AES-GCM secret vault/export/recovery; deadline/balance checks | Browser/domain tests; contract-flow tests; no secret or key sent to analytics/logs | `feat: add secure bidder workflow` |
| 10 | Operator flow | Deployer-only schedule form, pool/auction configuration validation, proceeds collection and receipts | Permission/read-only tests; contract simulation tests; deployer mismatch is blocked in UI | `feat: add auction operator controls` |
| 11 | Dashboard + evidence | Event-log feed, live auction state, countdowns, fee/swap receipts, two-bidder rehearsal checklist | Indexed-log fixtures; loading/error states; testnet rehearsal transcript once broadcast | `feat: add live auction dashboard` |
| 12 | Submission evidence update | Verified addresses, transaction links, public repository, demo recording, feedback-form status | Every link manually resolves; fresh checkout still green | `docs: record verified demo evidence` |

### Full roadmap after the live demo

| Chunk | Scope | Core deliverable | Acceptance gate | Commit intent |
| --- | --- | --- | --- | --- |
| 13 | Auction-value calculator | Editable volume, expected share, surcharge, bid and gas assumptions with break-even output and sensitivity table | Deterministic arithmetic tests; inputs/units/assumptions visible; never presented as a price quote | `feat: add auction value calculator` |
| 14 | Permit authorization | ERC-2612 permit path where the bid token supports it, and/or Permit2 adapter with explicit token/chain checks | Signature expiry/nonce/replay/failure tests; standard approval remains fallback; threat-model update | `feat: add permit-based bid approvals` |
| 15 | Harberger design | Written lease specification: valuation, rent interval, grace period, liquidation, takeover, refund and rights transition rules | Economic/security review before any Solidity implementation; user approval of rules | `docs: specify Harberger fee lease` |
| 16 | Harberger implementation | Isolated lease contract/adapter, rent settlement, takeover and executor eligibility integration | Stateful invariants for solvency and transitions; fuzz tests; local live-flow demo; independent review | `feat: add Harberger fee lease` |
| 17 | Production hardening | Event-indexing backend option, monitoring, pausing/incident policy if introduced, security review and deployment operations | Threat model, repeatable release procedure, testnet soak run and external audit plan | `docs: prepare production hardening` |

### Feature-to-chunk mapping

| Requested feature | Primary chunk | Depends on |
| --- | --- | --- |
| Real wallet + testnet mode | 8–9 | 7 |
| Pool bootstrap and rehearsal runner | 7 and 11 | funded testnet signer for public evidence |
| Auction dashboard | 11 | 8 |
| Bid-secret vault | 9 | 8 |
| Auction-value calculator | 13 | none; can run in parallel after the hackathon critical path |
| Deployer controls | 10 | 7–8 |
| Event-based analytics | 11, then 17 for a hosted indexer | 8 |
| Permit-based approvals | 14 | stable bidder flow and a clear token standard |
| Harberger lease | 15–16 | all MVP/testnet gates complete |

### Chunk 15 design result

The proposed mechanics, economic boundaries, accounting invariant, lease lifecycle, executor integration, test requirements, and owner approval gate are in [docs/HARBERGER.md](docs/HARBERGER.md). This records a reviewable design only. Do not begin Chunk 16 until the five explicit decisions in that document are approved.

### Operating rules for the expansion

- Keep contract configuration immutable per auction. Changes to a fee, recipient, pool, or schedule require a new auction rather than a mutable admin control.
- Test a complete local v4 path before every testnet broadcast. Broadcast only with a locally configured, funded signer; never paste private keys into chat or commits.
- Write an address/transaction manifest only after manually verifying the chain, bytecode and transaction receipts.
- Preserve ordinary ERC-20 approval as the fallback until permit paths are tested against the exact bid-token standard and target chain.
- Do not begin Harberger Solidity work until the written mechanics have been reviewed and approved; it is a materially different financial product from the sealed auction.
