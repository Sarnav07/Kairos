# Submission package

## Official ETHOnline 2026 requirements

The [official event guidance](https://ethglobal.com/events/ethonline2026/info/details) lists the submission deadline as **Sunday, September 13, 2026 at 12:00 pm EDT** (21:30 IST), requires a **2–4 minute** demo video, permits up to three partner-prize selections, and requires transparent attribution of AI assistance and reused work. The video must be at least 720p, must not be sped up, must use the builder's narration rather than an AI voice, and must not rely on music plus text as its explanation.

The [Uniswap Foundation prize page](https://ethglobal.com/events/ethonline2026/prizes/uniswap-foundation) additionally requires a public open-source repository, `FEEDBACK.md`, a completed Uniswap Developer Feedback Form containing the public feedback-file URL, and README pointers to relevant contracts and lines.

## Project-creation fields

| Field | Final value |
| --- | --- |
| Project name | **Kairos** |
| Category | **DeFi** |
| Emoji | **⏳** |
| Participation track | **Start Fresh / From Scratch** |
| Judge category | **Finalist and Partner Prizes** |
| Partner prize | **Uniswap Foundation — Best Uniswap Stack Contribution (Start Fresh eligibility)** |

## Showcase form copy

### Snappy one-liner — 72 characters

> Kairos auctions temporary Uniswap v4 app-fee rights through sealed bids.

### Project description

> Kairos turns a temporary trading privilege into an open, accountable market. Bidders first commit a domain-bound hash, then reveal a funded MockUSDC bid. The highest valid reveal wins a fixed-time right to route one KRA/KRB pool through an authenticated Uniswap v4 executor without paying Kairos's 5 bp application surcharge. The pool's 25 bp LP fee remains unchanged.
>
> The workstation makes the full lifecycle legible: fixed scheduling, encrypted local secret recovery, allowance and balance preflight, wallet-confirmed commit/reveal/refund/proceeds actions, live countdowns and event evidence, and a value calculator for comparing expected surcharge savings with bid and gas cost. A one-click local rehearsal proves the full interaction even if a public RPC or wallet is unavailable during judging.
>
> The auction, executor, fee hook, MockUSDC, KRA/KRB tokens, and hook-enabled pool are deployed on Unichain Sepolia. Kairos clearly separates verified deployment receipts, local simulation receipts, and the still-pending public two-bidder auction rehearsal.

### How it's made

> Kairos is a Solidity and React implementation built around unmodified Uniswap v4 core. `PFDAAuction` implements fixed-window sealed first-price commit/reveal allocation. Commitments bind chain ID, auction address, auction ID, bidder, bid amount, and salt; equal bids favor the earlier commitment. Successful revealers recover their fixed bond, non-revealers forfeit it, and pull-based settlement keeps operations bounded.
>
> `PFDAExecutor` authenticates the active winning caller and scopes eligibility to the current pool swap. `PFDAFeeHook` uses v4 hook accounting to collect a separate 5 bp application surcharge from ordinary callers and waive only that component for the eligible executor path. It does not modify the configured LP fee or claim to waive a native Uniswap protocol fee. `PFDAHookDeployer` mines the CREATE2 address bits required by v4 hook permissions.
>
> The Vite/React/TypeScript workstation uses viem for Unichain Sepolia reads and explicit wallet writes. It validates immutable wiring, encrypts bid recovery records locally with AES-GCM, checks commitment recovery before reveal, surfaces event receipts, and models fee-right value without presenting a quote or forecast. Foundry unit, integration, fuzz, invariant, and real-v4 tests cover the contracts; Vitest covers domain binding, the vault, dashboard, wallet runtime, and value arithmetic.

### Links

| Link type | Value |
| --- | --- |
| Source code | https://github.com/Sarnav07/Kairos |
| Public contract evidence | https://github.com/Sarnav07/Kairos/blob/main/docs/EVIDENCE.md |
| AI and reuse disclosure | https://github.com/Sarnav07/Kairos/blob/main/docs/AI_USAGE.md |
| Developer feedback file | https://github.com/Sarnav07/Kairos/blob/main/FEEDBACK.md |
| Live demo | https://kairos-lemon-delta.vercel.app |
| Demo video | **Pending: add only after the narrated 2–4 minute upload resolves** |

### Upload assets

1. Square logo: `docs/assets/kairos-logo.png`.
2. Cover/background image: `docs/assets/kairos-landing.jpg`.
3. Landing-page screenshot: `docs/assets/kairos-landing.jpg`.
4. Product screenshot: `docs/assets/kairos-live-desk.jpg`.
5. Controls screenshot: `docs/assets/kairos-auction-flow.jpg`.

## Uniswap partner-prize response

> Kairos integrates Uniswap v4 core, PoolManager, hook permissions, custom hook accounting, and a hook-enabled Unichain Sepolia pool. The PFDA auction allocates a time-limited application-fee right; the authenticated executor exposes that right to the hook for exactly the active winner and pool swap. The hook preserves the pool's LP fee while separately charging ordinary callers a 5 bp application surcharge. Relevant contracts and line-level evidence are indexed in the README. Deployment receipts, pool initialization, seeded liquidity, and immutable wiring are recorded in `docs/EVIDENCE.md` and `deployments/unichain-sepolia.json`.

## Uniswap Developer Feedback Form draft

Personal identity fields must be supplied by the builder and are intentionally not stored in the repository.

| Form field | Prepared answer |
| --- | --- |
| Hackathon | ETHOnline 2026 |
| Completed a project? | Yes |
| What did you build? | Kairos, a sealed first-price auction that allocates a temporary application-surcharge waiver for a Uniswap v4 pool on Unichain Sepolia, with authenticated execution, encrypted bid recovery, wallet controls, event evidence, and a local rehearsal fallback. |
| AI-powered or agentic project? | No: not in scope for what I'm building. AI assisted development and is disclosed separately. |
| Successfully integrated Uniswap? | Yes |
| First successful integration time | **Builder must choose truthfully: `<1 hour`, `1-4 hours`, `4-8 hours`, `8+ hours`, or `Didn't get there`.** |
| Biggest blocker | Correctly composing a separate input surcharge with v4 custom accounting while preserving LP fee growth, handling partial-fill boundaries, and keeping the claim distinct from native protocol-fee behavior. Mining a CREATE2 hook address with the exact permission bits was the second major integration challenge. |
| Agentic-app difficulty | Not applicable; Kairos is not an agentic product. |
| Documentation helpfulness | **Builder must choose the honest 1–5 rating.** |
| Support rating | **Builder must choose the honest 1–5 rating.** |
| Continue building? | **Builder must choose Yes, No, or Maybe.** |
| Support used | Technical docs; code examples/templates only if the builder actually used them. |
| Missing support | A worked v4 custom-accounting example that combines an input surcharge with LP fees, documents the rounding/composition order, and explains exact-input partial-fill handling would reduce implementation risk. A concise hook-address permission-mining walkthrough would also help. |
| Additional feedback | The v4 hook surface made it possible to prototype the PFDA mechanism without modifying core. Clearer cross-links between custom accounting, fee composition, hook permission bits, and chain deployment addresses would make the first successful integration faster. Public `FEEDBACK.md`: https://github.com/Sarnav07/Kairos/blob/main/FEEDBACK.md |

## Final submission sequence

1. Run `bash tools/verify-submission-evidence.sh` and the complete local test suite.
2. Push the current repository changes so every public link above resolves.
3. Complete the two-bidder testnet rehearsal if time and funded bidder wallets allow; otherwise describe it as pending and use the verified local rehearsal without fabricating receipts.
4. Record and upload the builder-narrated video using `docs/DEMO.md`; verify 2–4 minutes and at least 720p.
5. Deploy the frontend if a live-demo URL will be submitted; open the final URL in a fresh browser before adding it.
6. Complete the Uniswap Developer Feedback Form with personal fields and honest ratings, then verify the submission includes the public `FEEDBACK.md` URL.
7. Create/update the ETHGlobal project, select the Uniswap Foundation prize, upload the three screenshots, add the source/live/video links, and submit before the official deadline.

## Project summary

PFDA on Uniswap v4 is a sealed first-price auction for a time-limited right to waive an **application-level** swap surcharge. A bidder commits a domain-bound hash, reveals a funded MockUSDC bid, and—if selected—can execute one pool’s eligible exact-input swaps through an authenticated v4 executor during the fixed active window. The auction’s immutable deploying wallet receives the winning bid and forfeited non-reveal bonds.

The prototype does not claim to waive native Uniswap protocol fees, all swap fees, or establish the economic outcomes predicted in the supplied PFDA paper. LP fees remain configured by v4.

## Judge path

1. Start with the [README](../README.md) and its code map.
2. Run the complete local proof: `forge fmt --check && forge build && forge test --summary`.
3. Run the local demo: `cd app && npm ci && npm run dev`.
4. Inspect fee accounting in [FEE_ACCOUNTING.md](FEE_ACCOUNTING.md), auction rules in [AUCTION.md](AUCTION.md), and executor authentication in [EXECUTION.md](EXECUTION.md).
5. Run `bash tools/verify-submission-evidence.sh` to validate the public infrastructure links and pending-state guardrails, then `bash tools/verify-production-readiness.sh` to validate the pending soak/audit boundaries.
6. Follow the one-pass [REHEARSAL.md](REHEARSAL.md) only after a funded local testnet signer and two bidder wallets are available.

## ETHGlobal / Uniswap Foundation release gate

| Requirement | Status on 2026-09-10 | Evidence or required action |
| --- | --- | --- |
| Start Fresh project | Ready locally | Repository history starts with the project scaffold and records every implementation chunk. |
| Public open-source GitHub repository | Ready | [Sarnav07/Kairos](https://github.com/Sarnav07/Kairos) contains the full commit history and source. |
| `FEEDBACK.md` in the public repository | Ready | [Public FEEDBACK.md](https://github.com/Sarnav07/Kairos/blob/main/FEEDBACK.md) contains actual implementation observations. |
| Feedback form submitted with public `FEEDBACK.md` link | Pending user account action | Submit [Uniswap Developer Feedback Form](https://developers.uniswap.org/hackathon-feedback) with the resolved public URL. |
| README links to relevant contracts and lines | Ready locally | See the code map in [README](../README.md). |
| Demonstrable application | Ready; public rehearsal verified | React workstation deployed at [kairos-lemon-delta.vercel.app](https://kairos-lemon-delta.vercel.app), with live wallet-confirmed bidder and immutable-deployer controls, encrypted local bid vault, read-only event dashboard and assumption-labelled bid worksheet, plus source-tested ERC-2612 capability detection. The production browser rehearsal reaches the Active phase with five clearly labelled local receipts; 18 frontend tests and 90 passing Solidity tests. |
| Verified testnet contract and pool addresses | Ready; auction rehearsal pending | See the [public evidence register](EVIDENCE.md), [deployment manifest](../deployments/unichain-sepolia.json), and [TESTNET.md](TESTNET.md). |
| Demo video | Pending recording | Record the script in [DEMO.md](DEMO.md) and publish its URL in the project showcase. |

## Showcase copy draft

**Tagline:** Kairos auctions temporary Uniswap v4 app-fee rights through sealed bids.

**Description:** PFDA turns a temporary application-fee discount into a sealed first-price auction. Bidders commit before revealing their MockUSDC offer; the winner earns a fixed-time right to swap through an authenticated Uniswap v4 executor without the app-level surcharge. The hook preserves the pool’s LP fee settings, the auction pays proceeds to the deploying wallet, and the demo makes secret recovery, refunds, timing and fee boundaries visible. The current version has a deployed and verified Unichain Sepolia contract stack and hook pool; the public two-bidder auction rehearsal remains to be recorded.

## Evidence that must not be invented

- Do not enter a contract address, transaction hash, explorer link, live URL, video URL, or public GitHub permalink until it exists and has been manually opened.
- Do not describe the app-level surcharge waiver as a native Uniswap protocol-fee waiver.
- Do not describe local simulation receipts as transactions.
- Do not submit the feedback form until its `FEEDBACK.md` link resolves in the public repository.
