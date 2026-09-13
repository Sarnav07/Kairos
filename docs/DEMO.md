# Kairos 3:55 real-testnet demo

This is a silent visual-capture script for a later builder voice-over. Record the longer real rehearsal at desktop 1280×720 or higher, then make cut-only edits in iMovie. Never speed up footage or represent a local simulator receipt as a network transaction.

## Fixed rehearsal terms

| Setting | Value |
| --- | --- |
| Commit start delay | 5 minutes |
| Commit window | 8 minutes |
| Reveal window | 8 minutes |
| Activation delay | 30 minutes |
| Active-right window | 10 minutes |
| Bond / minimum bid | 1 / 10 mUSDC |
| Bidder A / Bidder B | 15 / 12 mUSDC |
| Test swaps | 100 KRA → KRB per bidder |

The two bidder wallets must be funded with Unichain Sepolia ETH before scheduling. The Live Desk permissionlessly mints valueless 50 mUSDC and 1,000 KRA test balances; it uses standard ERC-20 approvals on the verified deployment.

## Final edit timeline

| Time | Capture | Required visible evidence |
| --- | --- | --- |
| 0:00–0:16 | Open Kairos and the verified runtime rail. | Unichain Sepolia, KRA/KRB, and the boundary that only the 5 bp app surcharge is waived. |
| 0:16–0:43 | Connect the immutable deployer, keep the fixed terms visible, then create the auction. | Confirmed schedule receipt and fixed deadlines in the dashboard. |
| 0:43–1:14 | Bidder A mints mUSDC, prepares/encrypts a secret, approves the 1 mUSDC bond, and commits. | Bidder A’s confirmed receipt, then dashboard count of two commitments after Bidder B completes the same path off-cut. |
| 1:14–1:44 | Bidder A approves and reveals the sealed bid. | Dashboard count of two reveals after Bidder B reveals off-cut. |
| 1:44–2:18 | After the real reveal deadline, finalize; Bidder B claims its refund; deployer collects proceeds. | Three resolved receipts and the dashboard’s settlement state. |
| 2:18–2:54 | During the active window, mint/approve KRA and execute the fixed 100 KRA swap first as Bidder A, then Bidder B. | One discounted executor receipt, one ordinary executor receipt, and the app-surcharge distinction. |
| 2:54–3:31 | Show completed dashboard checklist and Protocol Economics Terminal. | Preserved 25 bp LP fee, 5 bp application surcharge difference, break-even and sensitivity. |
| 3:31–3:55 | Show source/live links and final MVP boundary. | Testnet-only scope, exact-input ERC-20/ERC-20 path, no native-fee waiver, no live Harberger lease. |

## Capture gate

- Record with microphone disabled. The human builder adds narration after the visual edit.
- Cut wallet-confirmation waits and deadline waits only; do not alter action order or playback speed.
- Keep private keys, seed phrases, vault passwords, salts, recovery-file contents, browser profiles, and unredacted wallet-extension details out of frame.
- Open every transaction in Uniscan before its clip appears in the final edit.
- Stop and restart the rehearsal if a phase is missed, a transaction fails, the dashboard disagrees with explorer state, or a private value is exposed.
- Export `kairos-demo-3m55.mov`, verify a duration of exactly 3:55 at 720p or higher, then add the final public video URL to the ETHGlobal project.
