# Public evidence register

Checked on 2026-09-10. This is the canonical release record for evidence that exists today. It deliberately separates deployed infrastructure from the unfinished public auction rehearsal.

Run `bash tools/verify-submission-evidence.sh` before submission. It validates the local manifest and checks the repository, feedback file, and all listed Uniscan receipts resolve publicly.

## Verified public infrastructure

| Evidence | Address or transaction | Public record |
| --- | --- | --- |
| Kairos source repository | `Sarnav07/Kairos` | [GitHub repository](https://github.com/Sarnav07/Kairos) |
| Public developer feedback file | `FEEDBACK.md` | [Feedback file](https://github.com/Sarnav07/Kairos/blob/main/FEEDBACK.md) |
| PFDA auction | `0xE30bd1162A9BB02C32EC8a0731014d45e1C15B73` | [deployment transaction](https://sepolia.uniscan.xyz/tx/0x55377286f6f02e3700f3fb7aab59b9fddb9874bb8c601882edbefacb4ae98aa4) |
| PFDA executor | `0x479E644B05876C6AD98cE59C2Fc94FB6C0E6b231` | [deployment transaction](https://sepolia.uniscan.xyz/tx/0xb03867062d0fe03e36c8259890fe2473ca8cfd38b053f02facbe492c6119895f) |
| PFDA fee hook | `0xBeE0b2606fdb9b70Ca3FB24254B674423f1e40c8` | [deployment transaction](https://sepolia.uniscan.xyz/tx/0x36c7162a5652776509e28247a1579dab667d9c109d2db81c93c3e150c223c0bf) |
| MockUSDC bid token | `0x7eef5a9C4289ECC5C53E2a35fac7D2Fb770048cd` | [deployment transaction](https://sepolia.uniscan.xyz/tx/0x461c21c8aec5db56090fd88d604c06b9fc4fbaf0fa1e41948702dd110cbf57a5) |
| KRA/KRB hook pool | `0x34626ba06dcca06958a701102c32034d3e0f035d9ea1629ec803e3cc8a093d4d` | [pool initialization](https://sepolia.uniscan.xyz/tx/0xe98738897c5f753b57aca3cad109c20f7d6964cadf38b5ddc738013bd7065280) |
| KRA/KRB seeded liquidity | pool bootstrap | [liquidity transaction](https://sepolia.uniscan.xyz/tx/0xbcb63c1e630e11597489dfc5b0d407e25862cfb3552dbb2df6512462f191894d) |

The immutable proceeds recipient is `0x54560095593B57Ad71572336037435Ff1E50E4EA`. The verified contract addresses, bytecode checks, pool configuration and complete transaction hash registry remain in [unichain-sepolia.json](../deployments/unichain-sepolia.json).

## Evidence intentionally not claimed yet

| Required record | Status | What must happen before adding a link |
| --- | --- | --- |
| Auction schedule | Pending | The immutable deployer creates a fixed schedule on Unichain Sepolia. |
| Two commitments and reveals | Pending | Two funded bidder wallets complete the live commit/reveal windows. |
| Finalization, refund and proceeds | Pending | A completed auction produces these separate receipts. |
| Winner and ordinary swaps | Pending | Record both executor swaps while the winning right is active. |
| Demo video | Pending | Record the script in [DEMO.md](DEMO.md) using those public receipts. |
| Uniswap developer feedback form | Pending user action | Submit the account-bound form with the public `FEEDBACK.md` URL. |

Do not turn a local simulator receipt, dashboard row, or test result into a transaction URL. When the rehearsal happens, add its resolved explorer links here and update the pending statuses in the manifest and [SUBMISSION.md](SUBMISSION.md).
