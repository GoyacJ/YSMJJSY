import { describe, expect, it } from 'vitest'
import { isValidUnlockCode } from './session'

describe('session service', () => {
  it('accepts the configured unlock code', () => {
    expect(isValidUnlockCode('100522', '100522')).toBe(true)
  })

  it('rejects other codes', () => {
    expect(isValidUnlockCode('000000', '100522')).toBe(false)
  })
})
