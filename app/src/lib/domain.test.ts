import { describe, expect, it } from 'vitest'
import {
  createBidSecret,
  DEMO_AUCTION_ADDRESS,
  DEMO_BIDDER,
  parseBidSecret,
  simulateTrade,
} from './domain'

describe('sealed-bid secret', () => {
  it('binds the commitment to bidder, auction and bid amount', () => {
    const first = createBidSecret({
      chainId: 1301,
      auctionAddress: DEMO_AUCTION_ADDRESS,
      auctionId: '7',
      bidder: DEMO_BIDDER,
      bidUsdc: '12.5',
      salt: `0x${'11'.repeat(32)}`,
    })
    const changedBid = createBidSecret({
      chainId: 1301,
      auctionAddress: DEMO_AUCTION_ADDRESS,
      auctionId: '7',
      bidder: DEMO_BIDDER,
      bidUsdc: '12.6',
      salt: `0x${'11'.repeat(32)}`,
    })

    expect(first.commitment).not.toEqual(changedBid.commitment)
    expect(first.bidAmountAtomic).toBe('12500000')
  })

  it('rejects a secret whose stored commitment was altered', () => {
    const secret = createBidSecret({
      chainId: 1301,
      auctionAddress: DEMO_AUCTION_ADDRESS,
      auctionId: '7',
      bidder: DEMO_BIDDER,
      bidUsdc: '12.5',
      salt: `0x${'22'.repeat(32)}`,
    })

    expect(() => parseBidSecret({ ...secret, commitment: `0x${'00'.repeat(32)}` })).toThrow(
      'does not match its commitment',
    )
  })
})

describe('fee comparison model', () => {
  it('removes only the application surcharge for a winner', () => {
    const ordinary = simulateTrade({ grossInputUsdc: 10_000, lpFeePpm: 2_500, surchargePpm: 500 }, false)
    const winner = simulateTrade({ grossInputUsdc: 10_000, lpFeePpm: 2_500, surchargePpm: 500 }, true)

    expect(ordinary.surchargeUsdc).toBe(5)
    expect(winner.surchargeUsdc).toBe(0)
    expect(winner.lpFeeUsdc).toBe(25)
    expect(winner.impliedOutputUsdc).toBeGreaterThan(ordinary.impliedOutputUsdc)
  })
})
