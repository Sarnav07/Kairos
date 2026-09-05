# PFDA on Uniswap v4

ETHOnline 2026 Start Fresh prototype of the Protocol Fee Discount Auction described by Adams et al. (October 2025).

## Status

Chunk 1 complete: six-decimal MockUSDC plus a PFDA surcharge hook tested against real v4 core locally. Auction-backed rights and secure winner execution are not implemented yet; no public testnet deployment has occurred.

## Agreed scope

- Unichain Sepolia, chain ID 1301.
- Sealed first-price commit/reveal auction for a time-limited trading right.
- MockUSDC ERC-20 bids; mock tokens have no monetary value.
- Auction proceeds go to the deploying wallet, derived from the deployment signer.
- Full waiver of the auctionable fee component; preserve the LP fee rate.
- Harberger leasing is a stretch goal after the complete MVP passes verification.

## Fee fidelity

The paper waives the protocol component, not every swap fee. Our hook keeps the LP rate fixed and collects a separate surcharge from non-eligible executors. Tests prove matching LP fee growth to an unhooked pool at equal net input. Native protocol fees still apply. With zero native protocol fees, a 5 bp surcharge followed by a 25 bp LP fee is approximately 29.9875 bp combined before integer rounding; the eligible executor pays 25 bp. This is an application-level analogue. Secure winner authentication follows in chunk 3.

See [fee accounting evidence and limits](docs/FEE_ACCOUNTING.md), [hook contract](src/PFDAFeeHook.sol), and [real-core tests](test/PFDAFeeHook.t.sol).

## Development

Install Foundry, then initialize pinned dependencies:

```sh
git submodule update --init --recursive
forge build
forge fmt --check
forge test -vv
```

See [PLAN.md](PLAN.md) for milestones and commit gates. See [FEEDBACK.md](FEEDBACK.md) for developer feedback collected during the build.

## Sources

- [ETHOnline Uniswap Foundation prize requirements](https://ethglobal.com/events/ethonline2026/prizes#uniswap-foundation)
- [Official v4 deployment addresses](https://developers.uniswap.org/docs/protocols/v4/deployments)
- Supplied paper: *The Protocol Fee Discount Auction*, October 2025. Section 2 defines the mechanism; Section 4's economic results are model predictions, not guarantees for this prototype.

Before submission, add deployment addresses, transaction evidence, exact contract/code permalinks, demo instructions, limitations, and the completed feedback-form status.
