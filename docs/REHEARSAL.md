# Two-bidder rehearsal handoff

## Purpose and current status

This is the only remaining ETHGlobal demo operation. It records real Unichain Sepolia receipts for the already verified auction stack and KRA/KRB pool. It does not deploy the Harberger mode, use permit actions on the existing deployment, or turn local simulator receipts into evidence.

Run the local gate first:

```sh
bash tools/verify-demo-readiness.sh
```

Then follow this checklist in order. Keep the app’s **Live evidence dashboard** open using the resulting auction ID, and save every explorer URL to [EVIDENCE.md](EVIDENCE.md) only after opening it manually.

## Roles and non-negotiables

| Role | Required account/action |
| --- | --- |
| Operator | The configured immutable auction deployer, `0x54560095593B57Ad71572336037435Ff1E50E4EA`; schedules the auction and collects proceeds. |
| Bidder A / Bidder B | Two distinct funded wallets. Each keeps its own amount and salt private until the reveal transaction. |
| Recorder | Captures the app, connected wallet address, auction ID, and Uniscan receipt pages. It does not display a private key, salt, encrypted-vault password, or recovery file contents. |

- Use the verified Unichain Sepolia auction, executor, hook, MockUSDC, and KRA/KRB pool listed in [TESTNET.md](TESTNET.md).
- The existing public pair uses ordinary ERC-20 approval. Do not attempt to demonstrate `commitWithPermit` or `revealWithPermit` on it.
- The right is only the 5 bp application surcharge. Both the winner and ordinary trader still pay LP fees; neither receives a native protocol-fee exemption.
- A missed deadline cannot be repaired. Do not start a recording until both bidder wallets and the operator wallet are connected, funded, and available for the complete timeline.

## Rehearsal sequence

1. **Preflight.** Load `.env` locally, verify `CHAIN_ID=1301`, public addresses, and `PFDA_POOL_ID`. Run the app and connect the operator wallet. Use the app’s operator panel to confirm it recognizes the immutable deployer.
2. **Schedule.** Review the timings in `.env` before broadcasting. The defaults are 5 minutes to commit start, 20-minute commit and reveal windows, a 35-minute activation delay, and a 30-minute active right. Schedule once:

   ```sh
   set -a
   source .env
   set +a
   forge script script/SchedulePFDAAuction.s.sol:SchedulePFDAAuction --rpc-url "$RPC_URL" --broadcast -vvvv
   ```

   Copy the printed auction ID and schedule transaction URL into the recording notes. Do not schedule a duplicate auction for the same pool while this window is reserved.
3. **Approve and commit.** Each bidder switches to Unichain Sepolia in the app, mints or obtains demonstration MockUSDC as appropriate, approves the exact commitment bond, generates and downloads its recovery file, and submits a commitment before commit end. Record both transaction URLs without revealing either amount or salt.
4. **Reveal.** Each bidder imports its own encrypted recovery record, verifies the commitment, approves the exact bid amount when needed, and reveals before reveal end. Record both receipt URLs and the dashboard’s reveal count.
5. **Finalize and settle.** After reveal end and before activation, anyone finalizes. The losing bidder withdraws its refund; the operator collects proceeds. Record finalization, refund, and proceeds receipt URLs, and confirm the deployed recipient address in the app/explorer.
6. **Compare swaps during the active window.** The winner uses `PFDAExecutor` for one supported exact-input KRA/KRB swap. A non-winner then executes the same supported path. Record both executor receipts and the hook surcharge receipt; the winner’s app surcharge is zero and the ordinary caller pays it. Keep the pool LP fee visible in the app/explorer context.
7. **Evidence and video.** Add only the opened, resolved receipt URLs to [EVIDENCE.md](EVIDENCE.md), update the manifest/status documents truthfully, then record [DEMO.md](DEMO.md). Submit the feedback form only after the public `FEEDBACK.md` URL resolves.

## Stop conditions

Stop the recording and start a new rehearsal rather than improvising if a wallet is on the wrong chain, an approval/reveal misses its window, a dashboard value conflicts with direct contract/explorer state, an RPC error persists, a pool swap is unsupported/partially filled, or any private material is exposed. Preserve the failed receipt and describe it accurately; never edit existing evidence to hide it.
