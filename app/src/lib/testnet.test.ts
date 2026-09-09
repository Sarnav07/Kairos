import { describe, expect, it } from 'vitest'
import {
  UNICHAIN_SEPOLIA_CHAIN_ID,
  explorerAddress,
  explorerTransaction,
  getWalletSnapshot,
  isUnichainSepolia,
  liveContracts,
  parseChainId,
  shortAddress,
  switchToUnichainSepolia,
} from './testnet'

describe('Unichain Sepolia runtime registry', () => {
  it('uses the verified chain, contract addresses, and explorer routes', () => {
    expect(UNICHAIN_SEPOLIA_CHAIN_ID).toBe(1301)
    expect(liveContracts.auction).toBe('0xE30bd1162A9BB02C32EC8a0731014d45e1C15B73')
    expect(explorerAddress(liveContracts.hook)).toBe(
      'https://sepolia.uniscan.xyz/address/0xBeE0b2606fdb9b70Ca3FB24254B674423f1e40c8',
    )
    expect(explorerTransaction(`0x${'a'.repeat(64)}`)).toBe(
      `https://sepolia.uniscan.xyz/tx/0x${'a'.repeat(64)}`,
    )
  })

  it('recognizes only Unichain Sepolia and parses wallet chain values safely', () => {
    expect(isUnichainSepolia(1301)).toBe(true)
    expect(isUnichainSepolia(1)).toBe(false)
    expect(parseChainId('0x515')).toBe(1301)
    expect(parseChainId('1301')).toBeNull()
    expect(parseChainId(null)).toBeNull()
  })

  it('shortens connected addresses without hiding disconnected state', () => {
    expect(shortAddress(liveContracts.executor)).toBe('0x479E···b231')
    expect(shortAddress(null)).toBe('Not connected')
  })

  it('hydrates an EIP-1193 wallet without requesting accounts on first render', async () => {
    const calls: string[] = []
    const snapshot = await getWalletSnapshot({
      request: async ({ method }) => {
        calls.push(method)
        if (method === 'eth_accounts') return [liveContracts.executor]
        return '0x515'
      },
    })
    expect(snapshot).toEqual({ address: liveContracts.executor, chainId: 1301 })
    expect(calls).toEqual(['eth_accounts', 'eth_chainId'])
  })

  it('asks a connected wallet to switch to the exact Unichain Sepolia chain', async () => {
    const calls: { method: string; params?: unknown[] }[] = []
    await switchToUnichainSepolia({
      request: async (request) => {
        calls.push(request)
        return null
      },
    })
    expect(calls).toEqual([
      { method: 'wallet_switchEthereumChain', params: [{ chainId: '0x515' }] },
    ])
  })
})
