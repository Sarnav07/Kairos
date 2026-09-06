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
