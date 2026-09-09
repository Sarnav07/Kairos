import { createWalletClient, custom, getAddress, type Address, type Hex } from 'viem'
import { liveContracts, publicClient, unichainSepolia, type Eip1193Provider } from './testnet'

const scheduleComponents = [
  { name: 'commitStart', type: 'uint64' },
  { name: 'commitEnd', type: 'uint64' },
  { name: 'revealEnd', type: 'uint64' },
  { name: 'activation', type: 'uint64' },
  { name: 'expiry', type: 'uint64' },
] as const

export const auctionAbi = [
  { type: 'function', name: 'nextAuctionId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalRefundable', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'treasuryCredit', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function', name: 'getAuction', stateMutability: 'view', inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [{
      name: 'auction', type: 'tuple', components: [
        { name: 'poolId', type: 'bytes32' }, { name: 'schedule', type: 'tuple', components: scheduleComponents },
        { name: 'bond', type: 'uint128' }, { name: 'minimumBid', type: 'uint128' },
        { name: 'commitments', type: 'uint256' }, { name: 'reveals', type: 'uint256' },
        { name: 'winner', type: 'address' }, { name: 'winningBid', type: 'uint128' },
        { name: 'winningOrder', type: 'uint256' }, { name: 'finalized', type: 'bool' }, { name: 'cancelled', type: 'bool' },
      ],
    }],
  },
  { type: 'function', name: 'phase', stateMutability: 'view', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'commit', stateMutability: 'nonpayable', inputs: [{ name: 'id', type: 'uint256' }, { name: 'commitment', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'reveal', stateMutability: 'nonpayable', inputs: [{ name: 'id', type: 'uint256' }, { name: 'amount', type: 'uint128' }, { name: 'salt', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'withdrawRefund', stateMutability: 'nonpayable', inputs: [{ name: 'id', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'collectProceeds', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    type: 'function', name: 'createAuction', stateMutability: 'nonpayable', inputs: [
      { name: 'poolId', type: 'bytes32' }, { name: 'schedule', type: 'tuple', components: scheduleComponents },
      { name: 'bond', type: 'uint128' }, { name: 'minimumBid', type: 'uint128' },
    ], outputs: [{ name: 'id', type: 'uint256' }],
  },
  {
    type: 'event', name: 'AuctionCreated', inputs: [
      { name: 'auctionId', type: 'uint256', indexed: true }, { name: 'poolId', type: 'bytes32', indexed: true },
      { name: 'schedule', type: 'tuple', components: scheduleComponents, indexed: false },
      { name: 'bond', type: 'uint128', indexed: false }, { name: 'minimumBid', type: 'uint128', indexed: false },
    ],
  },
  { type: 'event', name: 'BidCommitted', inputs: [{ name: 'auctionId', type: 'uint256', indexed: true }, { name: 'bidder', type: 'address', indexed: true }, { name: 'commitment', type: 'bytes32', indexed: false }, { name: 'order', type: 'uint256', indexed: false }] },
  { type: 'event', name: 'BidRevealed', inputs: [{ name: 'auctionId', type: 'uint256', indexed: true }, { name: 'bidder', type: 'address', indexed: true }, { name: 'amount', type: 'uint128', indexed: false }] },
  { type: 'event', name: 'AuctionFinalized', inputs: [{ name: 'auctionId', type: 'uint256', indexed: true }, { name: 'winner', type: 'address', indexed: true }, { name: 'winningBid', type: 'uint128', indexed: false }, { name: 'cancelled', type: 'bool', indexed: false }, { name: 'forfeitedBonds', type: 'uint256', indexed: false }] },
  { type: 'event', name: 'RefundWithdrawn', inputs: [{ name: 'auctionId', type: 'uint256', indexed: true }, { name: 'bidder', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }] },
  { type: 'event', name: 'ProceedsCollected', inputs: [{ name: 'recipient', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }] },
] as const

export const executorEventAbi = [
  { type: 'event', name: 'SwapExecuted', inputs: [{ name: 'auctionId', type: 'uint256', indexed: true }, { name: 'bidder', type: 'address', indexed: true }, { name: 'poolId', type: 'bytes32', indexed: true }, { name: 'discounted', type: 'bool', indexed: false }, { name: 'output', type: 'uint256', indexed: false }] },
] as const

export const hookEventAbi = [
  { type: 'event', name: 'SurchargeCollected', inputs: [{ name: 'poolId', type: 'bytes32', indexed: true }, { name: 'executor', type: 'address', indexed: true }, { name: 'currency', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }] },
] as const

const erc20Abi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const

export type LiveAuction = {
  poolId: Hex
  schedule: { commitStart: bigint; commitEnd: bigint; revealEnd: bigint; activation: bigint; expiry: bigint }
  bond: bigint
  minimumBid: bigint
  commitments: bigint
  reveals: bigint
  winner: Address
  winningBid: bigint
  winningOrder: bigint
  finalized: boolean
  cancelled: boolean
}

export type BidPreflight = { auction: LiveAuction; phase: number; balance: bigint; allowance: bigint }

export async function readBidPreflight(auctionId: bigint, bidder: Address): Promise<BidPreflight> {
  const [auction, phase, balance, allowance] = await Promise.all([
    readAuction(auctionId),
    publicClient.readContract({ address: liveContracts.auction, abi: auctionAbi, functionName: 'phase', args: [auctionId] }),
    publicClient.readContract({ address: liveContracts.mockUsdc, abi: erc20Abi, functionName: 'balanceOf', args: [bidder] }),
    publicClient.readContract({ address: liveContracts.mockUsdc, abi: erc20Abi, functionName: 'allowance', args: [bidder, liveContracts.auction] }),
  ])
  return { auction, phase: Number(phase), balance, allowance }
}

export async function readAuction(auctionId: bigint): Promise<LiveAuction> {
  return publicClient.readContract({
    address: liveContracts.auction,
    abi: auctionAbi,
    functionName: 'getAuction',
    args: [auctionId],
  }) as Promise<LiveAuction>
}

export async function readNextAuctionId(): Promise<bigint> {
  return publicClient.readContract({ address: liveContracts.auction, abi: auctionAbi, functionName: 'nextAuctionId' })
}

export async function approveBidToken(provider: Eip1193Provider, account: Address, amount: bigint): Promise<Hex> {
  return send(provider, account, liveContracts.mockUsdc, erc20Abi, 'approve', [liveContracts.auction, amount])
}

export async function commitBid(provider: Eip1193Provider, account: Address, auctionId: bigint, commitment: Hex): Promise<Hex> {
  return send(provider, account, liveContracts.auction, auctionAbi, 'commit', [auctionId, commitment])
}

export async function revealBid(provider: Eip1193Provider, account: Address, auctionId: bigint, amount: bigint, salt: Hex): Promise<Hex> {
  return send(provider, account, liveContracts.auction, auctionAbi, 'reveal', [auctionId, amount, salt])
}

export async function withdrawRefund(provider: Eip1193Provider, account: Address, auctionId: bigint): Promise<Hex> {
  return send(provider, account, liveContracts.auction, auctionAbi, 'withdrawRefund', [auctionId])
}

export async function collectProceeds(provider: Eip1193Provider, account: Address): Promise<Hex> {
  return send(provider, account, liveContracts.auction, auctionAbi, 'collectProceeds', [])
}

export async function createAuction(
  provider: Eip1193Provider,
  account: Address,
  schedule: LiveAuction['schedule'],
  bond: bigint,
  minimumBid: bigint,
): Promise<Hex> {
  return send(provider, account, liveContracts.auction, auctionAbi, 'createAuction', [liveContracts.poolId, schedule, bond, minimumBid])
}

async function send(
  provider: Eip1193Provider,
  account: Address,
  address: Address,
  abi: typeof auctionAbi | typeof erc20Abi,
  functionName: string,
  args: readonly unknown[],
): Promise<Hex> {
  const client = createWalletClient({
    account,
    chain: unichainSepolia,
    transport: custom(provider as never),
  })
  const hash = await client.writeContract({
    address,
    abi,
    functionName: functionName as never,
    args: args as never,
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('The transaction did not succeed on Unichain Sepolia.')
  return receipt.transactionHash
}

export function addressesMatch(first: Address | null, second: Address): boolean {
  return first !== null && getAddress(first) === getAddress(second)
}
