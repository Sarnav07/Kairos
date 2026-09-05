# PFDA on Uniswap v4

ETHOnline 2026 Start Fresh prototype of the Protocol Fee Discount Auction described by Adams et al. (October 2025).

## Status

Repository foundation with a six-decimal MockUSDC demo bid token and escrow-approval tests. Auction and hook contracts are not implemented or deployed yet.

## Agreed scope

- Unichain Sepolia, chain ID 1301.
- Sealed first-price commit/reveal auction for a time-limited trading right.
- MockUSDC ERC-20 bids; mock tokens have no monetary value.
- Auction proceeds go to the deploying wallet, derived from the deployment signer.
- Full waiver of the auctionable fee component; preserve the LP fee rate.
- Harberger leasing is a stretch goal after the complete MVP passes verification.

## Fee fidelity

The paper waives the protocol component, not every swap fee. A simple reduction of v4's dynamic LP fee is not equivalent: it reduces LP fee income. Our proposed prototype keeps the LP fee rate fixed and collects a separately accounted hook surcharge from non-winners, waiving that surcharge for an authenticated active winner. This is an application-level analogue, not an exemption from Uniswap's native protocol fee. Implementation is gated on a real v4 accounting test. Exact effective fees depend on how fee bases compose; illustrative 25 bp LP + 5 bp surcharge must not be presented as validated arithmetic before that test.

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
