import type { Address, Hex } from 'viem'
import { liveContracts } from './testnet'

export const FINALIZATION_PHASE = 3
export const ACTIVE_PHASE = 5
export const MOCK_USDC_MINT_AMOUNT = 50_000_000n
export const TEST_SWAP_INPUT_AMOUNT = 100n * 10n ** 18n
export const TEST_SWAP_MINT_AMOUNT = 1_000n * 10n ** 18n
export const TEST_SWAP_MINIMUM_OUTPUT = 1n
export const TEST_SWAP_DEADLINE_SECONDS = 10n * 60n
export const TEST_SWAP_SQRT_PRICE_LIMIT_X96 = 4_295_128_740n

export const TEST_SWAP_POOL_KEY = {
  currency0: liveContracts.kairosAlpha,
  currency1: liveContracts.kairosBeta,
  fee: 2_500,
  tickSpacing: 60,
  hooks: liveContracts.hook,
} as const satisfies {
  currency0: Address
  currency1: Address
  fee: number
  tickSpacing: number
  hooks: Address
}

export function canFinalizeAuction(phase: number): boolean {
  return phase === FINALIZATION_PHASE
}

export function canExecuteTestSwap(phase: number): boolean {
  return phase === ACTIVE_PHASE
}

export function buildTestSwapArgs(auctionId: bigint, nowSeconds: bigint): readonly [
  bigint,
  typeof TEST_SWAP_POOL_KEY,
  { zeroForOne: true; amountSpecified: bigint; sqrtPriceLimitX96: bigint },
  bigint,
  bigint,
] {
  return [
    auctionId,
    TEST_SWAP_POOL_KEY,
    {
      zeroForOne: true,
      amountSpecified: -TEST_SWAP_INPUT_AMOUNT,
      sqrtPriceLimitX96: TEST_SWAP_SQRT_PRICE_LIMIT_X96,
    },
    TEST_SWAP_MINIMUM_OUTPUT,
    nowSeconds + TEST_SWAP_DEADLINE_SECONDS,
  ]
}

export function isDiscountedWinner(winner: Address, bidder: Address): boolean {
  return winner.toLowerCase() === bidder.toLowerCase()
}

export function testSwapInputToken(): Address {
  return TEST_SWAP_POOL_KEY.currency0
}

export function testSwapOutputToken(): Address {
  return TEST_SWAP_POOL_KEY.currency1
}

export function testSwapPoolId(): Hex {
  return liveContracts.poolId
}
