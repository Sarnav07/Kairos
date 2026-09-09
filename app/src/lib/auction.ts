import { parseUnits } from 'viem'

export const MINIMUM_ACTIVATION_DELAY_SECONDS = 30 * 60
export const USDC_DECIMALS = 6

export type OperatorDurations = {
  commitDelayMinutes: number
  commitDurationMinutes: number
  revealDurationMinutes: number
  activationDelayMinutes: number
  rightDurationMinutes: number
}

export type AuctionSchedule = {
  commitStart: bigint
  commitEnd: bigint
  revealEnd: bigint
  activation: bigint
  expiry: bigint
}

export function buildSchedule(nowSeconds: bigint, durations: OperatorDurations): AuctionSchedule {
  const values = Object.values(durations)
  if (!values.every((value) => Number.isInteger(value) && value > 0)) {
    throw new Error('Every auction duration must be a positive whole number of minutes.')
  }
  if (durations.activationDelayMinutes * 60 < MINIMUM_ACTIVATION_DELAY_SECONDS) {
    throw new Error('Activation must wait at least 30 minutes after reveal closes.')
  }
  const minute = 60n
  const commitStart = nowSeconds + BigInt(durations.commitDelayMinutes) * minute
  const commitEnd = commitStart + BigInt(durations.commitDurationMinutes) * minute
  const revealEnd = commitEnd + BigInt(durations.revealDurationMinutes) * minute
  const activation = revealEnd + BigInt(durations.activationDelayMinutes) * minute
  return {
    commitStart,
    commitEnd,
    revealEnd,
    activation,
    expiry: activation + BigInt(durations.rightDurationMinutes) * minute,
  }
}

export function parseUsdc(value: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(value) || Number(value) <= 0) {
    throw new Error('Enter a positive USDC amount with at most six decimal places.')
  }
  return parseUnits(value, USDC_DECIMALS)
}

export function requiredAllowance(action: 'commit' | 'reveal', bond: bigint, bid: bigint): bigint {
  return action === 'commit' ? bond : bid
}
