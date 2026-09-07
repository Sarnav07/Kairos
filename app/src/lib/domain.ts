import {
  encodeAbiParameters,
  isAddress,
  keccak256,
  parseUnits,
  type Address,
  type Hex,
} from 'viem'

export const PPM_DENOMINATOR = 1_000_000
export const USDC_DECIMALS = 6

export type BidSecret = {
  version: 1
  chainId: number
  auctionAddress: Address
  auctionId: string
  bidder: Address
  bidUsdc: string
  bidAmountAtomic: string
  salt: Hex
  commitment: Hex
  createdAt: string
}

export type ScenarioInput = {
  grossInputUsdc: number
  lpFeePpm: number
  surchargePpm: number
}

export type ScenarioResult = {
  grossInputUsdc: number
  surchargeUsdc: number
  coreInputUsdc: number
  lpFeeUsdc: number
  impliedOutputUsdc: number
}

export const DEMO_CHAIN_ID = 1301
export const DEMO_AUCTION_ADDRESS = '0x000000000000000000000000000000000000a0c7' as Address
export const DEMO_BIDDER = '0x000000000000000000000000000000000000b1d0' as Address

export function randomSalt(): Hex {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}` as Hex
}

export function commitmentFor(input: Omit<BidSecret, 'commitment' | 'createdAt' | 'version' | 'bidAmountAtomic'>): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'uint256' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'uint128' },
        { type: 'bytes32' },
      ],
      [
        BigInt(input.chainId),
        input.auctionAddress,
        BigInt(input.auctionId),
        input.bidder,
        parseUnits(input.bidUsdc, USDC_DECIMALS),
        input.salt,
      ],
    ),
  )
}

export function createBidSecret(input: {
  chainId: number
  auctionAddress: Address
  auctionId: string
  bidder: Address
  bidUsdc: string
  salt?: Hex
}): BidSecret {
  const salt = input.salt ?? randomSalt()
  const commitment = commitmentFor({ ...input, salt })
  return {
    version: 1,
    ...input,
    bidAmountAtomic: parseUnits(input.bidUsdc, USDC_DECIMALS).toString(),
    salt,
    commitment,
    createdAt: new Date().toISOString(),
  }
}

export function parseBidSecret(value: unknown): BidSecret {
  if (typeof value !== 'object' || value === null) {
    throw new Error('The recovery file is not a PFDA bid secret.')
  }
  const candidate = value as Partial<BidSecret>
  if (
    candidate.version !== 1 ||
    typeof candidate.chainId !== 'number' ||
    !Number.isInteger(candidate.chainId) ||
    typeof candidate.auctionId !== 'string' ||
    !/^\d+$/.test(candidate.auctionId) ||
    typeof candidate.bidUsdc !== 'string' ||
    !/^\d+(\.\d{1,6})?$/.test(candidate.bidUsdc) ||
    typeof candidate.salt !== 'string' ||
    !/^0x[0-9a-fA-F]{64}$/.test(candidate.salt) ||
    typeof candidate.auctionAddress !== 'string' ||
    !isAddress(candidate.auctionAddress) ||
    typeof candidate.bidder !== 'string' ||
    !isAddress(candidate.bidder)
  ) {
    throw new Error('The recovery file is incomplete or has an invalid field.')
  }
  const rebuilt = createBidSecret({
    chainId: candidate.chainId,
    auctionAddress: candidate.auctionAddress,
    auctionId: candidate.auctionId,
    bidder: candidate.bidder,
    bidUsdc: candidate.bidUsdc,
    salt: candidate.salt as Hex,
  })
  if (candidate.commitment !== rebuilt.commitment) {
    throw new Error('The recovery file does not match its commitment.')
  }
  return {
    ...rebuilt,
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : rebuilt.createdAt,
  }
}

export function simulateTrade(input: ScenarioInput, hasDiscount: boolean): ScenarioResult {
  const grossInputUsdc = numberWithin(input.grossInputUsdc, 0)
  const lpFeePpm = numberWithin(input.lpFeePpm, 0, PPM_DENOMINATOR)
  const surchargePpm = numberWithin(input.surchargePpm, 0, PPM_DENOMINATOR)
  const surchargeUsdc = hasDiscount ? 0 : round6((grossInputUsdc * surchargePpm) / PPM_DENOMINATOR)
  const coreInputUsdc = round6(grossInputUsdc - surchargeUsdc)
  const lpFeeUsdc = round6((coreInputUsdc * lpFeePpm) / PPM_DENOMINATOR)
  return {
    grossInputUsdc,
    surchargeUsdc,
    coreInputUsdc,
    lpFeeUsdc,
    impliedOutputUsdc: round6(coreInputUsdc - lpFeeUsdc),
  }
}

export function displayUsdc(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function round6(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000
}

function numberWithin(value: number, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isFinite(value)) return minimum
  return Math.min(Math.max(value, minimum), maximum)
}
