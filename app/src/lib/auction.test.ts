import { describe, expect, it } from 'vitest'
import { buildSchedule, parseUsdc, requiredAllowance } from './auction'

describe('operator schedule and bidder allowance preflight', () => {
  it('builds ordered deadlines and preserves the 30-minute minimum activation buffer', () => {
    const schedule = buildSchedule(1_000n, {
      commitDelayMinutes: 5,
      commitDurationMinutes: 20,
      revealDurationMinutes: 20,
      activationDelayMinutes: 30,
      rightDurationMinutes: 30,
    })
    expect(schedule).toEqual({
      commitStart: 1_300n,
      commitEnd: 2_500n,
      revealEnd: 3_700n,
      activation: 5_500n,
      expiry: 7_300n,
    })
  })

  it('rejects unsafe timing and calculates exact per-step USDC allowances', () => {
    expect(() => buildSchedule(1_000n, {
      commitDelayMinutes: 5,
      commitDurationMinutes: 20,
      revealDurationMinutes: 20,
      activationDelayMinutes: 29,
      rightDurationMinutes: 30,
    })).toThrow('at least 30 minutes')
    expect(parseUsdc('10.000001')).toBe(10_000_001n)
    expect(requiredAllowance('commit', 1_000_000n, 10_000_000n)).toBe(1_000_000n)
    expect(requiredAllowance('reveal', 1_000_000n, 10_000_000n)).toBe(10_000_000n)
  })
})
