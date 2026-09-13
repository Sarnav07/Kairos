# Three-minute demo script

This script is intentionally split between the local product demo available now and the testnet recording required after deployment. Do not splice local receipts into the video as though they were block-explorer evidence.

The official ETHOnline 2026 rule is a builder-narrated video between 2 and 4 minutes, exported at 720p or better. Do not speed it up, use an AI voiceover, or substitute music and on-screen text for narration.

## 0:00–0:20 — Problem and boundary

Open the app. State: “PFDA auctions a temporary right to skip a 5 bp application surcharge. It does not remove the Uniswap LP fee or a native protocol fee.” Point to the side-by-side scenario runner and the retained 25 bp LP fee.

## 0:20–0:55 — Sealed bid safety

Set a bid amount, create the recovery file, download it, then recover it. Explain that the commitment binds the chain, auction, bidder, bid amount and salt. Show the warning that a missing secret cannot be revealed.

## 0:55–1:30 — Auction lifecycle

Use the demo clock to simulate commit, reveal, settlement, loser refund and active window. Read the receipt labels aloud: they are local simulation, not network transactions. Explain that equal bids use commitment order and that non-reveals forfeit only the fixed bond.

## 1:30–2:05 — Authenticated fee privilege

Show the scenario runner: ordinary caller versus active PFDA winner. Explain that both pay the LP fee; only the app surcharge is zero for the winner. Point to the code map in the README and the real-v4 integration test.

## 2:05–2:40 — Testnet rehearsal (record only after broadcast)

Replace this segment with a real Unichain Sepolia explorer walkthrough:

1. Deployed auction, executor and CREATE2-mined hook addresses.
2. Two bidder commitments and reveals.
3. Finalization, loser refund, and proceeds received by the deployer wallet.
4. Winner swap via PFDAExecutor and an ordinary comparison swap.

Before opening individual explorer pages, load the same auction ID in the app's **Live evidence dashboard**. It should show the phase and fixed deadline, event tape, treasury/refund state, and check off rehearsal rows only when the corresponding receipts are visible. The dashboard is a bounded recent-RPC view, so keep the auction and recording within the evidence window.

Keep each explorer URL visible long enough to read and add it to the showcase description.

## 2:40–3:00 — Limitations and next step

State the MVP scope: one ERC-20/ERC-20 pool, fully filled exact-input swaps, MockUSDC bids, no native-fee waiver, and no live Harberger lease. Close with the deployment and feedback links from the README.

## Recording and upload gate

- Record a desktop browser at 1280×720 or higher; do not use a phone recording.
- Use the builder's natural narration and keep the introduction under 20 seconds.
- Edit out wallet-confirmation and chain waiting time without changing playback speed.
- Keep private keys, salts, vault passwords, recovery files, email, Telegram, and wallet extension account details out of frame.
- Verify the final file duration is between 2:00 and 4:00 and the exported height is at least 720 pixels.
- Upload the video, open the final public URL in a signed-out window, then add it to `docs/SUBMISSION.md` and the ETHGlobal project.
