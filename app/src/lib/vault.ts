import type { BidSecret } from './domain'
import { parseBidSecret } from './domain'

const VERSION = 1
const ITERATIONS = 250_000
const PREFIX = 'kairos.bid-vault.v1'

export type EncryptedBidSecret = {
  version: 1
  algorithm: 'AES-GCM/PBKDF2-SHA-256'
  iterations: number
  salt: string
  iv: string
  ciphertext: string
  createdAt: string
  auctionId: string
  commitment: string
}

export type VaultStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

export async function encryptBidSecret(secret: BidSecret, password: string): Promise<EncryptedBidSecret> {
  if (password.length < 12) throw new Error('Use a vault password of at least 12 characters.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: bufferSource(iv) },
    key,
    new TextEncoder().encode(JSON.stringify(secret)),
  )
  return {
    version: VERSION,
    algorithm: 'AES-GCM/PBKDF2-SHA-256',
    iterations: ITERATIONS,
    salt: encodeBytes(salt),
    iv: encodeBytes(iv),
    ciphertext: encodeBytes(new Uint8Array(ciphertext)),
    createdAt: new Date().toISOString(),
    auctionId: secret.auctionId,
    commitment: secret.commitment,
  }
}

export async function decryptBidSecret(record: EncryptedBidSecret, password: string): Promise<BidSecret> {
  if (
    record.version !== VERSION || record.algorithm !== 'AES-GCM/PBKDF2-SHA-256'
    || record.iterations !== ITERATIONS
  ) throw new Error('This vault record uses an unsupported format.')
  try {
    const key = await deriveKey(password, decodeBytes(record.salt))
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bufferSource(decodeBytes(record.iv)) },
      key,
      bufferSource(decodeBytes(record.ciphertext)),
    )
    const secret = parseBidSecret(JSON.parse(new TextDecoder().decode(plaintext)))
    if (secret.commitment !== record.commitment || secret.auctionId !== record.auctionId) {
      throw new Error('The decrypted secret does not match its vault record.')
    }
    return secret
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not match')) throw error
    throw new Error('Could not unlock this vault record. Check the password.', { cause: error })
  }
}

export function saveVaultRecord(storage: VaultStorage, record: EncryptedBidSecret): void {
  storage.setItem(vaultKey(record.commitment), JSON.stringify(record))
}

export function listVaultRecords(storage: VaultStorage): EncryptedBidSecret[] {
  const records: EncryptedBidSecret[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key?.startsWith(PREFIX)) continue
    try {
      const record = JSON.parse(storage.getItem(key) ?? '') as EncryptedBidSecret
      if (record.version === VERSION && typeof record.commitment === 'string') records.push(record)
    } catch {
      // Ignore malformed local values rather than exposing them as recoverable secrets.
    }
  }
  return records.sort((first, second) => second.createdAt.localeCompare(first.createdAt))
}

export function deleteVaultRecord(storage: VaultStorage, commitment: string): void {
  storage.removeItem(vaultKey(commitment))
}

function vaultKey(commitment: string): string {
  return `${PREFIX}.${commitment.toLowerCase()}`
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bufferSource(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function encodeBytes(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function decodeBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

function bufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer
}
