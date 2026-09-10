export type AuctionValueInput = {
  poolVolumeUsdc: number
  captureSharePercent: number
  surchargeBasisPoints: number
  bidUsdc: number
  gasUsdc: number
}

export type AuctionValueEstimate = {
  eligibleVolumeUsdc: number
  surchargeSavingsUsdc: number
  allInCostUsdc: number
  netValueUsdc: number
  breakEvenEligibleVolumeUsdc: number | null
  breakEvenPoolVolumeUsdc: number | null
}

export function calculateAuctionValue(input: AuctionValueInput): AuctionValueEstimate {
  const poolVolumeUsdc = nonNegative(input.poolVolumeUsdc)
  const captureSharePercent = bounded(input.captureSharePercent, 0, 100)
  const surchargeBasisPoints = bounded(input.surchargeBasisPoints, 0, 10_000)
  const bidUsdc = nonNegative(input.bidUsdc)
  const gasUsdc = nonNegative(input.gasUsdc)
  const eligibleVolumeUsdc = poolVolumeUsdc * captureSharePercent / 100
  const surchargeSavingsUsdc = eligibleVolumeUsdc * surchargeBasisPoints / 10_000
  const allInCostUsdc = bidUsdc + gasUsdc
  const breakEvenEligibleVolumeUsdc = surchargeBasisPoints === 0
    ? null
    : allInCostUsdc * 10_000 / surchargeBasisPoints
  const breakEvenPoolVolumeUsdc = breakEvenEligibleVolumeUsdc === null || captureSharePercent === 0
    ? null
    : breakEvenEligibleVolumeUsdc * 100 / captureSharePercent
  return {
    eligibleVolumeUsdc,
    surchargeSavingsUsdc,
    allInCostUsdc,
    netValueUsdc: surchargeSavingsUsdc - allInCostUsdc,
    breakEvenEligibleVolumeUsdc,
    breakEvenPoolVolumeUsdc,
  }
}

export function sensitivityEstimates(input: AuctionValueInput): Array<{ label: string; estimate: AuctionValueEstimate }> {
  return [
    { label: 'Half volume', estimate: calculateAuctionValue({ ...input, poolVolumeUsdc: input.poolVolumeUsdc * 0.5 }) },
    { label: 'Expected', estimate: calculateAuctionValue(input) },
    { label: 'Double volume', estimate: calculateAuctionValue({ ...input, poolVolumeUsdc: input.poolVolumeUsdc * 2 }) },
  ]
}

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function bounded(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(nonNegative(value), minimum), maximum)
}
