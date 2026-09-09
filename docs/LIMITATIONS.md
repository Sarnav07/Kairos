# Known limitations

## Protocol and economic scope

- This is an application-level surcharge waiver, not a native Uniswap protocol-fee waiver and not a waiver of LP fees.
- The supplied paper’s welfare, LP-return and competition results are model predictions; this repository does not reproduce or guarantee them.
- The auction has a fixed commitment bond rather than bid-sized collateral at commit. A bidder can strategically avoid revelation by sacrificing that bond.
- Activation delay can reduce some exclusion incentives but does not guarantee censorship resistance or fair transaction ordering.
- Harberger leasing is deliberately deferred; there is no renewal, rent, takeover, or solvency system.

## Swap and token scope

- Only one pool per auction and fully filled, exact-input ERC-20/ERC-20 swaps are supported.
- Exact-output swaps, native-currency pools, partial fills, taxed/rebasing tokens and unusual output-token transfer behavior are unsupported.
- The executor validates hook getter wiring but does not prove arbitrary hook bytecode beyond the deployed setup and verification procedure.
- MockUSDC is permissionlessly mintable and has no monetary value.

## Deployment and product status

- The frontend supports user-confirmed Unichain Sepolia approvals, commits, reveals, refunds, scheduling and proceeds collection, but its lifecycle receipt ledger is still local simulation rather than an event indexer. A connected wallet alone never submits a transaction.
- The browser vault encrypts recovery records with AES-GCM and a user password, but it has no password recovery, cross-device synchronization or backup guarantee. The decrypted secret exists only for the browser session.
- The evidence dashboard reads a bounded recent public-RPC event window. It is not a historical indexer and pooled surcharge receipts are pool-scoped rather than provably attributable to one auction ID.
- The contract stack and KRA/KRB demonstration pool are publicly deployed on Unichain Sepolia, with addresses and receipts committed in `deployments/unichain-sepolia.json`. A complete auction rehearsal, demo video and submitted feedback form remain outstanding.
- A production implementation needs further threat modeling, audit, deployment monitoring, key management, frontend transaction state handling, and protocol-specific review.
