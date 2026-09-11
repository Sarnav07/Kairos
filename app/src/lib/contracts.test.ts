import { describe, expect, it } from 'vitest'
import { buildPermitRequest, PERMIT_TTL_SECONDS } from './contracts'
import { liveContracts } from './testnet'

describe('EIP-2612 bid authorization request', () => {
  it('binds an exact allowance to the Unichain token, auction, nonce, and deadline', () => {
    const request = buildPermitRequest(
      'Mock USDC',
      '0x54560095593B57Ad71572336037435Ff1E50E4EA',
      12_500_000n,
      7n,
      1_700_000_900n,
    )

    expect(PERMIT_TTL_SECONDS).toBe(900)
    expect(request.domain).toEqual({
      name: 'Mock USDC', version: '1', chainId: 1301, verifyingContract: liveContracts.mockUsdc,
    })
    expect(request.message).toEqual({
      owner: '0x54560095593B57Ad71572336037435Ff1E50E4EA',
      spender: liveContracts.auction,
      value: 12_500_000n,
      nonce: 7n,
      deadline: 1_700_000_900n,
    })
    expect(request.types.Permit.map((field) => field.name)).toEqual([
      'owner', 'spender', 'value', 'nonce', 'deadline',
    ])
  })
})
