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

- The frontend is a local simulator until addresses and a wallet connector are added after testnet deployment. Its receipts are not on-chain transactions.
- At the time of this document, no public testnet deployment, explorer receipt, public GitHub remote, demo video, or submitted feedback form exists.
- A production implementation needs further threat modeling, audit, deployment monitoring, key management, frontend transaction state handling, and protocol-specific review.
