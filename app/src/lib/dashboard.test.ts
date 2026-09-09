import { describe, expect, it } from 'vitest'
import { formatCountdown, phaseDeadline, rehearsalSteps, type AuctionActivity } from './dashboard'
import type { LiveAuction } from './contracts'

const auction: LiveAuction = {
  poolId: `0x${'11'.repeat(32)}`,
  schedule: { commitStart: 1_100n, commitEnd: 1_400n, revealEnd: 1_700n, activation: 3_500n, expiry: 5_300n },
  bond: 1_000_000n, minimumBid: 10_000_000n, commitments: 0n, reveals: 0n,
  winner: '0x0000000000000000000000000000000000000000', winningBid: 0n, winningOrder: 0n, finalized: false, cancelled: false,
}

const activity = (kind: AuctionActivity['kind'], detail = ''): AuctionActivity => ({
  kind, detail, title: kind, blockNumber: 1n, transactionHash: `0x${'12'.repeat(32)}`, logIndex: 0,
})

describe('live auction dashboard helpers', () => {
  it('maps each live phase to the right fixed deadline and formats a stable countdown', () => {
    expect(phaseDeadline(1, auction)).toEqual({ label: 'Commit closes', timestamp: 1_400n })
    expect(phaseDeadline(3, auction)).toEqual({ label: 'Finalize before', timestamp: 3_500n })
    expect(phaseDeadline(5, auction)).toEqual({ label: 'Right expires', timestamp: 5_300n })
    expect(formatCountdown(3_661n)).toBe('01:01:01')
    expect(formatCountdown(0n)).toBe('now')
  })

  it('only marks rehearsal evidence complete when the corresponding on-chain events exist', () => {
    const incomplete = rehearsalSteps([activity('schedule'), activity('commit')])
    expect(incomplete.map((step) => step.complete)).toEqual([true, false, false, false, false])
    const complete = rehearsalSteps([
      activity('schedule'), activity('commit'), activity('commit'), activity('reveal'), activity('reveal'),
      activity('finalize'), activity('refund'), activity('proceeds'), activity('swap', 'discounted'), activity('swap', 'ordinary'),
    ])
    expect(complete.every((step) => step.complete)).toBe(true)
  })
})
