import { describe, expect, it } from 'vitest'
import {
  ACTIVE_PHASE,
  buildTestSwapArgs,
  canExecuteTestSwap,
  canFinalizeAuction,
  FINALIZATION_PHASE,
  MOCK_USDC_MINT_AMOUNT,
  TEST_SWAP_DEADLINE_SECONDS,
  TEST_SWAP_INPUT_AMOUNT,
  TEST_SWAP_MINT_AMOUNT,
  TEST_SWAP_POOL_KEY,
} from './live-demo'
import { liveContracts } from './testnet'

describe('live testnet demo controls', () => {
  it('gates finalization and executor swaps to their only valid auction phases', () => {
    expect(canFinalizeAuction(FINALIZATION_PHASE)).toBe(true)
    expect(canFinalizeAuction(ACTIVE_PHASE)).toBe(false)
    expect(canExecuteTestSwap(ACTIVE_PHASE)).toBe(true)
    expect(canExecuteTestSwap(FINALIZATION_PHASE)).toBe(false)
  })

  it('uses the immutable KRA/KRB pool and exact testnet preflight amounts', () => {
    expect(MOCK_USDC_MINT_AMOUNT).toBe(50_000_000n)
    expect(TEST_SWAP_MINT_AMOUNT).toBe(1_000n * 10n ** 18n)
    expect(TEST_SWAP_INPUT_AMOUNT).toBe(100n * 10n ** 18n)
    expect(TEST_SWAP_POOL_KEY).toEqual({
      currency0: liveContracts.kairosAlpha,
      currency1: liveContracts.kairosBeta,
      fee: 2_500,
      tickSpacing: 60,
      hooks: liveContracts.hook,
    })
  })

  it('encodes a fixed KRA-to-KRB exact-input executor request', () => {
    const args = buildTestSwapArgs(9n, 10_000n)
    expect(args[0]).toBe(9n)
    expect(args[1]).toBe(TEST_SWAP_POOL_KEY)
    expect(args[2]).toMatchObject({ zeroForOne: true, amountSpecified: -TEST_SWAP_INPUT_AMOUNT })
    expect(args[3]).toBe(1n)
    expect(args[4]).toBe(10_000n + TEST_SWAP_DEADLINE_SECONDS)
  })
})
