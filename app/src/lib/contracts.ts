import { createWalletClient, custom, getAddress, parseSignature, zeroHash, type Address, type Hex } from 'viem'
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
  { type: 'function', name: 'commitWithPermit', stateMutability: 'nonpayable', inputs: [{ name: 'id', type: 'uint256' }, { name: 'commitment', type: 'bytes32' }, { name: 'deadline', type: 'uint256' }, { name: 'v', type: 'uint8' }, { name: 'r', type: 'bytes32' }, { name: 's', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'reveal', stateMutability: 'nonpayable', inputs: [{ name: 'id', type: 'uint256' }, { name: 'amount', type: 'uint128' }, { name: 'salt', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'revealWithPermit', stateMutability: 'nonpayable', inputs: [{ name: 'id', type: 'uint256' }, { name: 'amount', type: 'uint128' }, { name: 'salt', type: 'bytes32' }, { name: 'deadline', type: 'uint256' }, { name: 'v', type: 'uint8' }, { name: 'r', type: 'bytes32' }, { name: 's', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'permitAuthorizationVersion', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
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
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const

const permitAbi = [
  { type: 'function', name: 'nonces', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'DOMAIN_SEPARATOR', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
] as const

const permitTypes = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

export const PERMIT_TTL_SECONDS = 15 * 60

export type PermitSupport =
  | { status: 'available'; tokenName: string; nonce: bigint }
  | { status: 'unavailable'; reason: string }

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

export type BidPreflight = {
  auction: LiveAuction
  phase: number
  balance: bigint
  allowance: bigint
  permit: PermitSupport
}

export async function readBidPreflight(auctionId: bigint, bidder: Address): Promise<BidPreflight> {
  const [auction, phase, balance, allowance] = await Promise.all([
    readAuction(auctionId),
    publicClient.readContract({ address: liveContracts.auction, abi: auctionAbi, functionName: 'phase', args: [auctionId] }),
    publicClient.readContract({ address: liveContracts.mockUsdc, abi: erc20Abi, functionName: 'balanceOf', args: [bidder] }),
    publicClient.readContract({ address: liveContracts.mockUsdc, abi: erc20Abi, functionName: 'allowance', args: [bidder, liveContracts.auction] }),
  ])
  const permit = await readPermitSupport(bidder)
  return { auction, phase: Number(phase), balance, allowance, permit }
}

async function readPermitSupport(bidder: Address): Promise<PermitSupport> {
  try {
    const [tokenName, nonce, domainSeparator, authorizationVersion] = await Promise.all([
      publicClient.readContract({ address: liveContracts.mockUsdc, abi: erc20Abi, functionName: 'name' }),
      publicClient.readContract({ address: liveContracts.mockUsdc, abi: permitAbi, functionName: 'nonces', args: [bidder] }),
      publicClient.readContract({ address: liveContracts.mockUsdc, abi: permitAbi, functionName: 'DOMAIN_SEPARATOR' }),
      publicClient.readContract({ address: liveContracts.auction, abi: auctionAbi, functionName: 'permitAuthorizationVersion' }),
    ])
    if (!tokenName || domainSeparator === zeroHash || authorizationVersion !== 1) {
      return { status: 'unavailable', reason: 'This token and auction do not expose the supported ERC-2612 path.' }
    }
    return { status: 'available', tokenName, nonce }
  } catch {
    return { status: 'unavailable', reason: 'This deployed stack uses the standard ERC-20 approval path.' }
  }
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

export async function permitAndCommitBid(
  provider: Eip1193Provider,
  account: Address,
  auctionId: bigint,
  commitment: Hex,
  permit: Extract<PermitSupport, { status: 'available' }>,
  bond: bigint,
): Promise<Hex> {
  const signature = await signBidPermit(provider, account, permit.tokenName, bond)
  return send(provider, account, liveContracts.auction, auctionAbi, 'commitWithPermit', [
    auctionId, commitment, signature.deadline, signature.v, signature.r, signature.s,
  ])
}

export async function revealBid(provider: Eip1193Provider, account: Address, auctionId: bigint, amount: bigint, salt: Hex): Promise<Hex> {
  return send(provider, account, liveContracts.auction, auctionAbi, 'reveal', [auctionId, amount, salt])
}

export async function permitAndRevealBid(
  provider: Eip1193Provider,
  account: Address,
  auctionId: bigint,
  amount: bigint,
  salt: Hex,
  permit: Extract<PermitSupport, { status: 'available' }>,
): Promise<Hex> {
  const signature = await signBidPermit(provider, account, permit.tokenName, amount)
  return send(provider, account, liveContracts.auction, auctionAbi, 'revealWithPermit', [
    auctionId, amount, salt, signature.deadline, signature.v, signature.r, signature.s,
  ])
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
  abi: typeof auctionAbi | typeof erc20Abi | typeof permitAbi,
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

async function signBidPermit(
  provider: Eip1193Provider,
  account: Address,
  tokenName: string,
  value: bigint,
): Promise<{ deadline: bigint; v: number; r: Hex; s: Hex }> {
  const nonce = await publicClient.readContract({
    address: liveContracts.mockUsdc,
    abi: permitAbi,
    functionName: 'nonces',
    args: [account],
  })
  const deadline = BigInt(Math.floor(Date.now() / 1_000) + PERMIT_TTL_SECONDS)
  const client = createWalletClient({
    account,
    chain: unichainSepolia,
    transport: custom(provider as never),
  })
  const signature = await client.signTypedData(buildPermitRequest(tokenName, account, value, nonce, deadline))
  const { yParity, r, s } = parseSignature(signature)
  return { deadline, v: yParity + 27, r, s }
}

export function buildPermitRequest(
  tokenName: string,
  owner: Address,
  value: bigint,
  nonce: bigint,
  deadline: bigint,
) {
  return {
    domain: { name: tokenName, version: '1', chainId: unichainSepolia.id, verifyingContract: liveContracts.mockUsdc },
    types: permitTypes,
    primaryType: 'Permit' as const,
    message: { owner, spender: liveContracts.auction, value, nonce, deadline },
  }
}

export function addressesMatch(first: Address | null, second: Address): boolean {
  return first !== null && getAddress(first) === getAddress(second)
}
