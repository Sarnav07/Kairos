# Submission package

## Project summary

PFDA on Uniswap v4 is a sealed first-price auction for a time-limited right to waive an **application-level** swap surcharge. A bidder commits a domain-bound hash, reveals a funded MockUSDC bid, and—if selected—can execute one pool’s eligible exact-input swaps through an authenticated v4 executor during the fixed active window. The auction’s immutable deploying wallet receives the winning bid and forfeited non-reveal bonds.

The prototype does not claim to waive native Uniswap protocol fees, all swap fees, or establish the economic outcomes predicted in the supplied PFDA paper. LP fees remain configured by v4.

## Judge path

1. Start with the [README](../README.md) and its code map.
2. Run the complete local proof: `forge fmt --check && forge build && forge test --summary`.
3. Run the local demo: `cd app && npm ci && npm run dev`.
4. Inspect fee accounting in [FEE_ACCOUNTING.md](FEE_ACCOUNTING.md), auction rules in [AUCTION.md](AUCTION.md), and executor authentication in [EXECUTION.md](EXECUTION.md).
5. Follow [TESTNET.md](TESTNET.md) only after a funded local testnet signer is available.

## ETHGlobal / Uniswap Foundation release gate

| Requirement | Status on 2026-09-09 | Evidence or required action |
| --- | --- | --- |
| Start Fresh project | Ready locally | Repository history starts with the project scaffold and records every implementation chunk. |
| Public open-source GitHub repository | Ready | [Sarnav07/Kairos](https://github.com/Sarnav07/Kairos) contains the full commit history and source. |
| `FEEDBACK.md` in the public repository | Ready locally | [FEEDBACK.md](../FEEDBACK.md) contains actual implementation observations. |
| Feedback form submitted with public `FEEDBACK.md` link | Pending user account action | Submit [Uniswap Developer Feedback Form](https://developers.uniswap.org/hackathon-feedback) after the remote exists. |
| README links to relevant contracts and lines | Ready locally | See the code map in [README](../README.md). |
| Demonstrable application | Ready; rehearsal pending | React workstation with live wallet-confirmed bidder and immutable-deployer controls, encrypted local bid vault, read-only event dashboard, 14 frontend tests and 74 passing Solidity tests. |
| Verified testnet contract and pool addresses | Ready; auction rehearsal pending | See [deployment manifest](../deployments/unichain-sepolia.json) and [TESTNET.md](TESTNET.md). |
| Demo video | Pending recording | Record the script in [DEMO.md](DEMO.md) and publish its URL in the project showcase. |

## Showcase copy draft

**Tagline:** Auction a temporary fee privilege without turning it into a permanent routing advantage.

**Description:** PFDA turns a temporary application-fee discount into a sealed first-price auction. Bidders commit before revealing their MockUSDC offer; the winner earns a fixed-time right to swap through an authenticated Uniswap v4 executor without the app-level surcharge. The hook preserves the pool’s LP fee settings, the auction pays proceeds to the deploying wallet, and the demo makes secret recovery, refunds, timing and fee boundaries visible. The current version has a deployed and verified Unichain Sepolia contract stack and hook pool; the public two-bidder auction rehearsal remains to be recorded.

## Evidence that must not be invented

- Do not enter a contract address, transaction hash, explorer link, live URL, video URL, or public GitHub permalink until it exists and has been manually opened.
- Do not describe the app-level surcharge waiver as a native Uniswap protocol-fee waiver.
- Do not describe local simulation receipts as transactions.
- Do not submit the feedback form until its `FEEDBACK.md` link resolves in the public repository.
