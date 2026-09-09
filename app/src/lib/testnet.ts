import {
  createPublicClient,
  defineChain,
  getAddress,
  http,
  isAddress,
  type Address,
  type Hex,
} from 'viem'

export const UNICHAIN_SEPOLIA_CHAIN_ID = 1301
export const UNICHAIN_SEPOLIA_RPC_URL = 'https://sepolia.unichain.org'
export const UNICHAIN_SEPOLIA_EXPLORER = 'https://sepolia.uniscan.xyz'

export const unichainSepolia = defineChain({
  id: UNICHAIN_SEPOLIA_CHAIN_ID,
  name: 'Unichain Sepolia',
  nativeCurrency: { name: 'Unichain Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [UNICHAIN_SEPOLIA_RPC_URL] } },
  blockExplorers: { default: { name: 'Uniscan', url: UNICHAIN_SEPOLIA_EXPLORER } },
  testnet: true,
})

export const liveContracts = {
  poolManager: '0x00B036B58a818B1BC34d502D3fE730Db729e62AC',
  mockUsdc: '0x7eef5a9C4289ECC5C53E2a35fac7D2Fb770048cd',
  auction: '0xE30bd1162A9BB02C32EC8a0731014d45e1C15B73',
  executor: '0x479E644B05876C6AD98cE59C2Fc94FB6C0E6b231',
  hook: '0xBeE0b2606fdb9b70Ca3FB24254B674423f1e40c8',
  kairosAlpha: '0x99AA7178Df76ef8b21A1Bf71CB33CF02D8E7C8E0',
  kairosBeta: '0xd1a8f94E0c330FD0f8b19De9b6F586300a83538C',
  poolId: '0x34626ba06dcca06958a701102c32034d3e0f035d9ea1629ec803e3cc8a093d4d',
} as const satisfies Record<string, Address | Hex>

const auctionAbi = [
  { type: 'function', name: 'deployer', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'bidToken', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const executorAbi = [
  { type: 'function', name: 'manager', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'auction', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const hookAbi = [
  { type: 'function', name: 'manager', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'eligibility', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'recipient', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'surchargePpm', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint24' }] },
] as const

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

export type WalletSnapshot = {
  address: Address | null
  chainId: number | null
}

export type ProtocolSnapshot = {
  blockNumber: bigint
  auctionDeployer: Address
  auctionBidToken: Address
  executorManager: Address
  executorAuction: Address
  hookManager: Address
  hookEligibility: Address
  hookRecipient: Address
  hookSurchargePpm: number
  wiringValid: boolean
}

export const publicClient = createPublicClient({ chain: unichainSepolia, transport: http() })

export function isUnichainSepolia(chainId: number | null): boolean {
  return chainId === UNICHAIN_SEPOLIA_CHAIN_ID
}

export function explorerAddress(address: Address): string {
  return `${UNICHAIN_SEPOLIA_EXPLORER}/address/${address}`
}

export function explorerTransaction(hash: Hex): string {
  return `${UNICHAIN_SEPOLIA_EXPLORER}/tx/${hash}`
}

export function shortAddress(address: Address | null): string {
  return address ? `${address.slice(0, 6)}···${address.slice(-4)}` : 'Not connected'
}

export function parseChainId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^0x[\da-f]+$/i.test(value)) return Number.parseInt(value, 16)
  return null
}

export function getInjectedProvider(): Eip1193Provider | null {
  const candidate = (globalThis as typeof globalThis & { ethereum?: unknown }).ethereum
  if (
    typeof candidate !== 'object' || candidate === null || !('request' in candidate)
    || typeof candidate.request !== 'function'
  ) return null
  return candidate as Eip1193Provider
}

export async function getWalletSnapshot(provider: Eip1193Provider, requestAccounts = false): Promise<WalletSnapshot> {
  const [accountsValue, chainValue] = await Promise.all([
    provider.request({ method: requestAccounts ? 'eth_requestAccounts' : 'eth_accounts' }),
    provider.request({ method: 'eth_chainId' }),
  ])
  const accounts = Array.isArray(accountsValue) ? accountsValue : []
  const firstAccount = accounts[0]
  return {
    address: typeof firstAccount === 'string' && isAddress(firstAccount) ? getAddress(firstAccount) : null,
    chainId: parseChainId(chainValue),
  }
}

export async function switchToUnichainSepolia(provider: Eip1193Provider): Promise<void> {
  await provider.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: `0x${UNICHAIN_SEPOLIA_CHAIN_ID.toString(16)}` }],
  })
}

export async function readProtocolSnapshot(): Promise<ProtocolSnapshot> {
  const [blockNumber, auctionDeployer, auctionBidToken, executorManager, executorAuction, hookManager, hookEligibility, hookRecipient, hookSurchargePpm] = await Promise.all([
    publicClient.getBlockNumber(),
    publicClient.readContract({ address: liveContracts.auction, abi: auctionAbi, functionName: 'deployer' }),
    publicClient.readContract({ address: liveContracts.auction, abi: auctionAbi, functionName: 'bidToken' }),
    publicClient.readContract({ address: liveContracts.executor, abi: executorAbi, functionName: 'manager' }),
    publicClient.readContract({ address: liveContracts.executor, abi: executorAbi, functionName: 'auction' }),
    publicClient.readContract({ address: liveContracts.hook, abi: hookAbi, functionName: 'manager' }),
    publicClient.readContract({ address: liveContracts.hook, abi: hookAbi, functionName: 'eligibility' }),
    publicClient.readContract({ address: liveContracts.hook, abi: hookAbi, functionName: 'recipient' }),
    publicClient.readContract({ address: liveContracts.hook, abi: hookAbi, functionName: 'surchargePpm' }),
  ])
  const snapshot = {
    blockNumber,
    auctionDeployer: getAddress(auctionDeployer),
    auctionBidToken: getAddress(auctionBidToken),
    executorManager: getAddress(executorManager),
    executorAuction: getAddress(executorAuction),
    hookManager: getAddress(hookManager),
    hookEligibility: getAddress(hookEligibility),
    hookRecipient: getAddress(hookRecipient),
    hookSurchargePpm: Number(hookSurchargePpm),
  }
  return {
    ...snapshot,
    wiringValid:
      snapshot.auctionBidToken === liveContracts.mockUsdc
      && snapshot.executorManager === liveContracts.poolManager
      && snapshot.executorAuction === liveContracts.auction
      && snapshot.hookManager === liveContracts.poolManager
      && snapshot.hookEligibility === liveContracts.executor
      && snapshot.hookRecipient === snapshot.auctionDeployer
      && snapshot.hookSurchargePpm === 500,
  }
}
