# AI use and build provenance

This file records how AI tools and prior open-source work were used in Kairos. It exists to satisfy the ETHOnline 2026 transparency rule and should be linked in the final project description.

## Builder direction

The solo builder made and approved the project-defining decisions:

- start from a new repository in the Start Fresh track;
- implement a sealed first-price commit/reveal auction first;
- use Unichain Sepolia, MockUSDC bids, and the deploying wallet as the immutable proceeds recipient;
- waive the application surcharge for the active winner while preserving the pool LP fee;
- keep Harberger leasing isolated as an undeployed stretch mode;
- require a test-and-commit gate after each implementation chunk;
- direct the landing-page, workstation, and demo-rehearsal revisions;
- retain control of deployment credentials and sign all testnet transactions.

## AI-assisted work

OpenAI Codex assisted with repository scaffolding, Solidity and TypeScript implementation, test drafting, documentation, UI implementation, debugging, release checks, and preparation of submission copy. The builder reviewed the project in bounded chunks and explicitly selected the protocol design, scope, target network, treasury behavior, visual direction, and release order.

AI assistance was broad, not hidden behind a claim that individual generated files were handwritten. The principal assisted areas are:

| Area | Representative files | Verification or control |
| --- | --- | --- |
| Protocol planning | `PLAN.md`, `PROGRESS.md`, `docs/*.md` | Builder-approved chunk scope and decisions; repository history records delivery order. |
| Auction and fee contracts | `src/PFDAAuction.sol`, `src/PFDAFeeHook.sol`, `src/PFDAExecutor.sol` | Foundry unit, integration, fuzz, and invariant tests. |
| Testnet scripts and evidence | `script/*.s.sol`, `deployments/unichain-sepolia.json`, `docs/EVIDENCE.md` | Builder-controlled signer; public Uniscan receipts; immutable wiring checks. |
| Frontend and local simulator | `app/src/**` | ESLint, Vitest, TypeScript, Vite production build, and browser rehearsal. |
| Submission material | `README.md`, `FEEDBACK.md`, `docs/SUBMISSION.md`, `docs/DEMO.md` | Claims are restricted to evidence that resolves publicly or passes locally. |

## Prompt and specification record

The development conversation was iterative rather than a single code-generation prompt. The builder's material prompts and decisions were, in order:

1. Analyze the supplied PFDA paper and plan an ETHGlobal Start Fresh implementation.
2. Compare a v4 hook prototype with a chain-agnostic auction and compare auction formats.
3. Select sealed first-price commit/reveal, with Harberger leasing only if time allowed.
4. Select Unichain Sepolia, ERC-20 bids, a full application-surcharge waiver, and deployer-recipient proceeds.
5. Build in tested chunks with one descriptive commit after each accepted chunk.
6. Add testnet bootstrap, wallet flow, encrypted bid recovery, operator controls, event evidence, value modelling, permit support, Harberger stretch mode, and production boundaries.
7. Redesign the user experience using Alpha & Oversight as a visual reference, then add a one-click end-to-end local rehearsal.
8. Prepare the repository and copy for the ETHGlobal and Uniswap Foundation submission requirements.

The detailed specifications, constraints, acceptance gates, dead ends, and current release boundaries are preserved in `PLAN.md`, `PROGRESS.md`, `docs/AUCTION.md`, `docs/FEE_ACCOUNTING.md`, `docs/EXECUTION.md`, `docs/HARBERGER.md`, `docs/PRODUCTION.md`, and `docs/LIMITATIONS.md`.

## Reused and referenced work

- [Uniswap v4 core](https://github.com/Uniswap/v4-core) is included as a pinned git submodule and remains unmodified.
- [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts) and [forge-std](https://github.com/foundry-rs/forge-std) are pinned submodules.
- [Alpha & Oversight](https://github.com/PrathamSingla15/alpha-oversight), an MIT-licensed project, was used as a visual and interaction reference for the landing experience. Kairos replaces its product content, diagrams, state, controls, data model, and application logic with PFDA-specific work.
- The supplied paper, *The Protocol Fee Discount Auction* (Adams et al., October 2025), motivated the mechanism. Kairos implements an application-level analogue and does not claim that its hook can waive native Uniswap protocol fees.

## What the AI did not do

AI tools did not own or expose the deployment private key, approve wallet prompts, sign transactions, submit the ETHGlobal project, submit the Uniswap feedback form, or record the builder's required human-narrated demo video.
