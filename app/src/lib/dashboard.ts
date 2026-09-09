import type { Address, Hex } from 'viem'
import { auctionAbi, executorEventAbi, hookEventAbi, readAuction, type LiveAuction } from './contracts'
import { liveContracts, publicClient } from './testnet'

export const DASHBOARD_LOOKBACK_BLOCKS = 25_000n
export const DEPLOYMENT_BLOCK = 62_101_285n

export type ActivityKind = 'schedule' | 'commit' | 'reveal' | 'finalize' | 'refund' | 'proceeds' | 'swap' | 'surcharge'

export type AuctionActivity = {
  kind: ActivityKind
  title: string
  detail: string
  blockNumber: bigint
  transactionHash: Hex
  logIndex: number
}

export type AuctionDashboard = {
  auctionId: bigint
  auction: LiveAuction
  phase: number
  blockNumber: bigint
  blockTimestamp: bigint
  treasuryCredit: bigint
  totalRefundable: bigint
  windowStartBlock: bigint
  activity: AuctionActivity[]
}

export type RehearsalStep = { label: string; detail: string; complete: boolean }

type EventLog = {
  eventName: string
  args: Record<string, unknown>
  blockNumber: bigint
  transactionHash: Hex
  logIndex: number
}

export async function readAuctionDashboard(auctionId: bigint): Promise<AuctionDashboard> {
  const [auction, phase, treasuryCredit, totalRefundable, block] = await Promise.all([
    readAuction(auctionId),
    publicClient.readContract({ address: liveContracts.auction, abi: auctionAbi, functionName: 'phase', args: [auctionId] }),
    publicClient.readContract({ address: liveContracts.auction, abi: auctionAbi, functionName: 'treasuryCredit' }),
    publicClient.readContract({ address: liveContracts.auction, abi: auctionAbi, functionName: 'totalRefundable' }),
    publicClient.getBlock(),
  ])
  const windowStartBlock = block.number > DASHBOARD_LOOKBACK_BLOCKS
    ? block.number - DASHBOARD_LOOKBACK_BLOCKS
    : DEPLOYMENT_BLOCK
  const logs = await Promise.all([
    publicClient.getContractEvents({ address: liveContracts.auction, abi: auctionAbi, eventName: 'AuctionCreated', args: { auctionId }, fromBlock: windowStartBlock }),
    publicClient.getContractEvents({ address: liveContracts.auction, abi: auctionAbi, eventName: 'BidCommitted', args: { auctionId }, fromBlock: windowStartBlock }),
    publicClient.getContractEvents({ address: liveContracts.auction, abi: auctionAbi, eventName: 'BidRevealed', args: { auctionId }, fromBlock: windowStartBlock }),
    publicClient.getContractEvents({ address: liveContracts.auction, abi: auctionAbi, eventName: 'AuctionFinalized', args: { auctionId }, fromBlock: windowStartBlock }),
    publicClient.getContractEvents({ address: liveContracts.auction, abi: auctionAbi, eventName: 'RefundWithdrawn', args: { auctionId }, fromBlock: windowStartBlock }),
    publicClient.getContractEvents({ address: liveContracts.auction, abi: auctionAbi, eventName: 'ProceedsCollected', fromBlock: windowStartBlock }),
    publicClient.getContractEvents({ address: liveContracts.executor, abi: executorEventAbi, eventName: 'SwapExecuted', args: { auctionId }, fromBlock: windowStartBlock }),
    publicClient.getContractEvents({ address: liveContracts.hook, abi: hookEventAbi, eventName: 'SurchargeCollected', args: { poolId: liveContracts.poolId }, fromBlock: windowStartBlock }),
  ])
  return {
    auctionId,
    auction,
    phase: Number(phase),
    blockNumber: block.number,
    blockTimestamp: block.timestamp,
    treasuryCredit,
    totalRefundable,
    windowStartBlock,
    activity: toActivity(logs.flat() as unknown as EventLog[]),
  }
}

export function phaseDeadline(phase: number, auction: LiveAuction): { label: string; timestamp: bigint | null } {
  if (phase === 0) return { label: 'Commit opens', timestamp: auction.schedule.commitStart }
  if (phase === 1) return { label: 'Commit closes', timestamp: auction.schedule.commitEnd }
  if (phase === 2) return { label: 'Reveal closes', timestamp: auction.schedule.revealEnd }
  if (phase === 3) return { label: 'Finalize before', timestamp: auction.schedule.activation }
  if (phase === 4) return { label: 'Right activates', timestamp: auction.schedule.activation }
  if (phase === 5) return { label: 'Right expires', timestamp: auction.schedule.expiry }
  return { label: phase === 7 ? 'Auction cancelled' : 'Auction complete', timestamp: null }
}

export function formatCountdown(seconds: bigint): string {
  if (seconds <= 0n) return 'now'
  const hours = seconds / 3_600n
  const minutes = (seconds % 3_600n) / 60n
  const remainingSeconds = seconds % 60n
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function rehearsalSteps(activity: AuctionActivity[]): RehearsalStep[] {
  const count = (kind: ActivityKind) => activity.filter((item) => item.kind === kind).length
  const swaps = activity.filter((item) => item.kind === 'swap')
  return [
    { label: 'Fixed auction scheduled', detail: 'Record terms and commit/reveal windows.', complete: count('schedule') >= 1 },
    { label: 'Two bidders committed', detail: 'Two hash-only commitments are visible.', complete: count('commit') >= 2 },
    { label: 'Two bidders revealed', detail: 'Two funded bids are visible.', complete: count('reveal') >= 2 },
    { label: 'Finalize and settle', detail: 'Finalization, a refund, and proceeds are visible.', complete: count('finalize') >= 1 && count('refund') >= 1 && count('proceeds') >= 1 },
    { label: 'Compare winner and ordinary swaps', detail: 'One discounted and one ordinary executor swap are visible.', complete: swaps.some((item) => item.detail.includes('discounted')) && swaps.some((item) => item.detail.includes('ordinary')) },
  ]
}

function toActivity(logs: EventLog[]): AuctionActivity[] {
  return logs.map((log) => {
    const args = log.args
    if (log.eventName === 'AuctionCreated') return activity(log, 'schedule', 'Auction scheduled', `Auction #${value(args.auctionId)} terms fixed on-chain.`)
    if (log.eventName === 'BidCommitted') return activity(log, 'commit', 'Bid committed', `${short(args.bidder as Address)} committed in order #${value(args.order)}.`)
    if (log.eventName === 'BidRevealed') return activity(log, 'reveal', 'Bid revealed', `${short(args.bidder as Address)} revealed ${formatMockUsdc(args.amount)}.`)
    if (log.eventName === 'AuctionFinalized') return activity(log, 'finalize', args.cancelled ? 'Auction cancelled' : 'Auction finalized', args.cancelled ? 'No active right was sold.' : `${short(args.winner as Address)} won with ${formatMockUsdc(args.winningBid)}.`)
    if (log.eventName === 'RefundWithdrawn') return activity(log, 'refund', 'Refund claimed', `${short(args.bidder as Address)} received ${formatMockUsdc(args.amount)}.`)
    if (log.eventName === 'ProceedsCollected') return activity(log, 'proceeds', 'Proceeds collected', `${short(args.recipient as Address)} received ${formatMockUsdc(args.amount)}.`)
    if (log.eventName === 'SwapExecuted') return activity(log, 'swap', 'Executor swap', `${short(args.bidder as Address)} executed an ${args.discounted ? 'discounted' : 'ordinary'} swap.`)
    return activity(log, 'surcharge', 'Pool surcharge collected', `${formatMockUsdc(args.amount)} surcharge reached the auction recipient.`)
  }).sort((first, second) => Number(second.blockNumber - first.blockNumber) || second.logIndex - first.logIndex)
}

function activity(log: EventLog, kind: ActivityKind, title: string, detail: string): AuctionActivity {
  return { kind, title, detail, blockNumber: log.blockNumber, transactionHash: log.transactionHash, logIndex: log.logIndex }
}

function value(value: unknown): string { return String(value) }
function short(address: Address): string { return `${address.slice(0, 6)}···${address.slice(-4)}` }
function formatMockUsdc(amount: unknown): string { return `${formatUnits(BigInt(amount as bigint), 6)} MockUSDC` }

function formatUnits(amount: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals)
  const whole = amount / base
  const fraction = (amount % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole.toString()
}
