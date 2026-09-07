# PFDA on Uniswap v4

ETHOnline 2026 Start Fresh prototype of the Protocol Fee Discount Auction described by Adams et al. (October 2025).

## Status

Chunk 4 complete: the sealed auction, authenticated executor and surcharge hook work together against real v4 core locally. A local demo workstation now creates and recovers commit secrets, walks the auction lifecycle and compares the surcharge treatment. MockUSDC funds bids and the deploying wallet receives proceeds. No public deployment has occurred.

## Agreed scope

- Unichain Sepolia, chain ID 1301.
- Sealed first-price commit/reveal auction for a time-limited trading right.
- MockUSDC ERC-20 bids; mock tokens have no monetary value.
- Auction proceeds go to the deploying wallet, derived from the deployment signer.
- Full waiver of the auctionable fee component; preserve the LP fee rate.
- Harberger leasing is a stretch goal after the complete MVP passes verification.

## Fee fidelity

The paper waives the protocol component, not every swap fee. Our hook keeps the LP rate fixed and collects a separate surcharge from non-eligible executors. Tests prove matching LP fee growth to an unhooked pool at equal net input. Native protocol fees still apply. With zero native protocol fees, a 5 bp surcharge followed by a 25 bp LP fee is approximately 29.9875 bp combined before integer rounding; the eligible executor pays 25 bp. This is an application-level analogue. PFDAExecutor authenticates the active winning caller and scopes the waiver to its current pool swap.

See [fee accounting evidence and limits](docs/FEE_ACCOUNTING.md), [hook contract](src/PFDAFeeHook.sol), and [real-core tests](test/PFDAFeeHook.t.sol).

## Auction

See the [auction contract](src/PFDAAuction.sol) and [auction rules and escrow evidence](docs/AUCTION.md). Bidders deposit a fixed bond at commit and fund their bid at reveal. The highest valid revealed bid wins; equal bids favor the earlier commitment. Successful revealers recover their bond; non-revealers forfeit it. Finalization at/after activation cancels the right and refunds revealed bids. The deploying wallet receives winning bids and forfeited bonds.

## Development

The [executor contract](src/PFDAExecutor.sol), [integration tests](test/PFDAIntegration.t.sol), and [execution specification](docs/EXECUTION.md) show the complete local auction-to-swap flow, authentication boundaries and supported swap modes.

Install Foundry, then initialize pinned dependencies:

```sh
git submodule update --init --recursive
forge build
forge fmt --check
forge test -vv
```

See [PLAN.md](PLAN.md) for milestones and commit gates. See [FEEDBACK.md](FEEDBACK.md) for developer feedback collected during the build.

## Local demo workstation

The React/Vite app in [app/](app/) is a deliberately offline simulation until testnet addresses exist. It makes a domain-bound commit secret, exports/recover it as JSON, produces receipts labelled as local simulation, and models the difference between an ordinary caller and an active PFDA winner. It does **not** connect a wallet or claim that any action was broadcast.

```sh
cd app
npm install
npm run lint
npm run test
npm run build
```

See [app/README.md](app/README.md) for the run instructions and boundary. The scenario model preserves the 25 bp LP fee and only removes the 5 bp application surcharge; it is an arithmetic comparison, not a swap quote.

## Sources

- [ETHOnline Uniswap Foundation prize requirements](https://ethglobal.com/events/ethonline2026/prizes#uniswap-foundation)
- [Official v4 deployment addresses](https://developers.uniswap.org/docs/protocols/v4/deployments)
- Supplied paper: *The Protocol Fee Discount Auction*, October 2025. Section 2 defines the mechanism; Section 4's economic results are model predictions, not guarantees for this prototype.

Before submission, add deployment addresses, transaction evidence, exact contract/code permalinks, demo instructions, limitations, and the completed feedback-form status.
