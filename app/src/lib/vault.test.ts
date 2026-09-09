import { describe, expect, it } from 'vitest'
import { createBidSecret, DEMO_AUCTION_ADDRESS, DEMO_BIDDER } from './domain'
import { decryptBidSecret, encryptBidSecret, listVaultRecords, saveVaultRecord } from './vault'

const secret = createBidSecret({
  chainId: 1301,
  auctionAddress: DEMO_AUCTION_ADDRESS,
  auctionId: '1',
  bidder: DEMO_BIDDER,
  bidUsdc: '12.5',
  salt: `0x${'12'.repeat(32)}`,
})

describe('encrypted bid-secret vault', () => {
  it('encrypts a secret and requires the exact password to unlock it', async () => {
    const record = await encryptBidSecret(secret, 'a-long-vault-password')
    expect(record.ciphertext).not.toContain(secret.salt.slice(2))
    await expect(decryptBidSecret(record, 'wrong-vault-password')).rejects.toThrow('Check the password')
    await expect(decryptBidSecret(record, 'a-long-vault-password')).resolves.toMatchObject({
      commitment: secret.commitment,
      salt: secret.salt,
    })
  })

  it('stores only encrypted records under its dedicated local keyspace', async () => {
    const values = new Map<string, string>()
    const storage = {
      get length() { return values.size },
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      key: (index: number) => [...values.keys()][index] ?? null,
    }
    const record = await encryptBidSecret(secret, 'a-long-vault-password')
    saveVaultRecord(storage, record)
    expect(listVaultRecords(storage)).toHaveLength(1)
    expect([...values.values()].join('')).not.toContain(secret.salt.slice(2))
  })
})
