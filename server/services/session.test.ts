import { describe, expect, it } from 'vitest'
import {
  createKeySessionToken,
  isValidUnlockCode,
  readKeySessionToken,
} from './session'

describe('session service', () => {
  it('accepts the configured unlock code', () => {
    expect(isValidUnlockCode('100522', '100522')).toBe(true)
  })

  it('rejects other codes', () => {
    expect(isValidUnlockCode('000000', '100522')).toBe(false)
  })

  it('creates and verifies signed key session tokens', () => {
    const token = createKeySessionToken('key_1', 'secret')

    expect(readKeySessionToken(token, 'secret')?.keyId).toBe('key_1')
    expect(readKeySessionToken(`${token}x`, 'secret')).toBeUndefined()
  })
})
