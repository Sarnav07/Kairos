import { describe, expect, it } from 'vitest'
import { calculateAuctionValue, sensitivityEstimates } from './value'

describe('auction-value calculator', () => {
  it('calculates eligible volume, surcharge savings, all-in cost, net value, and both break-even views', () => {
    expect(calculateAuctionValue({
      poolVolumeUsdc: 1_000_000,
      captureSharePercent: 20,
      surchargeBasisPoints: 5,
      bidUsdc: 60,
      gasUsdc: 10,
    })).toEqual({
      eligibleVolumeUsdc: 200_000,
      surchargeSavingsUsdc: 100,
      allInCostUsdc: 70,
      netValueUsdc: 30,
      breakEvenEligibleVolumeUsdc: 140_000,
      breakEvenPoolVolumeUsdc: 700_000,
    })
  })

  it('handles no surcharge or capture share without inventing a break-even number', () => {
    const noSurcharge = calculateAuctionValue({ poolVolumeUsdc: 100_000, captureSharePercent: 50, surchargeBasisPoints: 0, bidUsdc: 10, gasUsdc: 1 })
    expect(noSurcharge.breakEvenEligibleVolumeUsdc).toBeNull()
    expect(noSurcharge.breakEvenPoolVolumeUsdc).toBeNull()
    const noShare = calculateAuctionValue({ poolVolumeUsdc: 100_000, captureSharePercent: 0, surchargeBasisPoints: 5, bidUsdc: 10, gasUsdc: 1 })
    expect(noShare.breakEvenEligibleVolumeUsdc).toBe(22_000)
    expect(noShare.breakEvenPoolVolumeUsdc).toBeNull()
  })

  it('builds deterministic half, expected, and double-volume sensitivity cases', () => {
    const cases = sensitivityEstimates({ poolVolumeUsdc: 100_000, captureSharePercent: 100, surchargeBasisPoints: 10, bidUsdc: 40, gasUsdc: 10 })
    expect(cases.map((item) => item.label)).toEqual(['Half volume', 'Expected', 'Double volume'])
    expect(cases.map((item) => item.estimate.netValueUsdc)).toEqual([0, 50, 150])
  })
})
