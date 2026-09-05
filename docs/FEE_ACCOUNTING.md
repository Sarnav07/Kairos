# Chunk 1: v4 fee accounting proof

## Result

Unmodified v4 PoolManager supports a separately collected input-token hook surcharge while leaving the pool's LP fee rate unchanged. An eligible executor can bypass the surcharge. This is a working application-level analogue of PFDA, not an exemption from native Uniswap protocol fees.

Implementation: `src/PFDAFeeHook.sol`. Evidence: `test/PFDAFeeHook.t.sol` deploys real v4 core locally, initializes two pools with equal liquidity and price, and compares the hooked pool against an unhooked control. Core is pinned as a Git submodule to `46c6834698c48bc4a463a86d8420f4eb1d7f3b75`.

## Money flow

For an ordinary exact-input swap with gross input A:

1. Compute C = floor(A * surchargePpm / 1,000,000).
2. In beforeSwap, PoolManager.take sends C units of the input currency to the immutable recipient.
3. Return a positive specified-currency hook delta C. Core trades A - C and charges its usual fees on that amount; LP fee override is zero.
4. In afterSwap, require full consumption of A - C. A partial fill reverts the entire transaction, including the earlier recipient transfer.
5. v4 accounts the positive hook delta against the take debt and charges the caller the total A. A successful unlock demonstrates all transient currency debts have settled.

For an eligible executor C is zero. The full A goes through core. Eligibility is keyed by pool ID and the actual PoolManager caller. Arbitrary hookData is ignored by this accounting hook.

The immutable recipient is supplied to the constructor. Future deployment scripts must pass the actual deploying wallet as agreed. Tests use a distinct fixture recipient to make transfers measurable. These are swap surcharges; winning auction bids are a separate money flow implemented in chunk 2.

## Fee composition

At LP fee L = 0.0025 (25 bp), surcharge S = 0.0005 (5 bp), and zero native protocol fee, ignoring integer rounding:

- Ordinary swap: effective fee = S + (1 - S) * L = 0.00299875 = 29.9875 bp.
- Winner: effective fee = L = 0.0025 = 25 bp.

For gross input of 1,000 token units:

| Component | Ordinary executor | Eligible executor |
| --- | ---: | ---: |
| Hook surcharge | 0.5 | 0 |
| Input reaching core | 999.5 | 1,000 |
| LP fee, ideal arithmetic | 2.49875 | 2.5 |

The LP rate is preserved; absolute LP fees depend on the amount reaching core. At equal core input, fee growth, output, and price movement are identical to the control. At equal gross input, the eligible executor gets more output and, in these fixtures, generates more LP fee growth. This does not prove higher long-term LP returns or reproduce the paper's market-equilibrium claims.

Hook surcharge rounds down to input-token units. With a six-decimal token, gross input below 2,000 atomic units produces zero surcharge at 500 ppm. This intentional dust behavior is tested. Core applies its own integer rounding.

## Native protocol fee interaction

The tests activate a 500 ppm native protocol fee in both directions through the local manager's controller. Both eligible and ordinary swaps still accrue native protocol fees, matching the unhooked control at equal core input. The hook has no protocol-controller permission and does not change this configuration.

With native fees enabled, core composes protocol and LP fees using its ProtocolFeeLibrary; the hook surcharge sits outside that composition. Do not advertise a 25 bp all-in winner fee when native protocol fees are active.

## Tested boundaries and limits

- Both swap directions; eligibility on and off; native protocol fees on and off.
- Fuzzed input amounts from 10,000 through 1e12 atomic units, with 256 runs.
- Exact recipient payment, total caller debit, manager balance increase, and zero retained hook tokens.
- Identical LP fee growth, output and terminal price to an equal-core-input control pool.
- Same-gross-input winner advantage in both directions.
- Rounding threshold, direct callback rejection, spoofed hookData, pool-scoped eligibility.
- Explicit wrapped hook errors for exact-output and oversized input; rollback on partial fill.
- Invalid recipient and excessive surcharge rejected at construction.

Only fully filled exact-input ERC-20 swaps are supported. Native-currency pools, exact-output swaps and partial fills are rejected. Surcharge configuration is immutable and capped at 1% in this prototype. Tests use ordinary MockUSDC tokens and fixed liquidity; unusual token behaviors and arbitrary concentrated-liquidity configurations are outside this proof.

`EligibilityFixture` and v4's `PoolSwapTest` are test utilities. In this fixture, eligibility grants the test router a discount; that router is public and is not a secure winner executor. Chunk 3 must supply auction-backed eligibility and an executor that authenticates the winner. Do not deploy this fixture arrangement. Eligibility must remain stable for the duration of a swap.

No contracts were deployed to a public testnet in this chunk. Local use of real core contracts is not a fork test against the deployed Unichain bytecode.

## Reproduce

```sh
git submodule update --init --recursive
forge fmt --check
forge build
forge test -vv
```

## Code references

- [Pinned PoolManager: swaps, hook deltas and settlement](https://github.com/Uniswap/v4-core/blob/46c6834698c48bc4a463a86d8420f4eb1d7f3b75/src/PoolManager.sol)
- [Pinned Hooks: before/after swap accounting](https://github.com/Uniswap/v4-core/blob/46c6834698c48bc4a463a86d8420f4eb1d7f3b75/src/libraries/Hooks.sol)
- [Pinned ProtocolFeeLibrary: protocol/LP fee composition](https://github.com/Uniswap/v4-core/blob/46c6834698c48bc4a463a86d8420f4eb1d7f3b75/src/libraries/ProtocolFeeLibrary.sol)
