import { describe, expect, it } from 'vitest'
import {
  createCsrfToken,
  createKeySessionToken,
  createOpaqueSessionToken,
  isValidUnlockCode,
  readDbBackedSession,
  readOpaqueSessionToken,
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

  it('creates and verifies opaque database-backed session tokens', () => {
    const token = createOpaqueSessionToken('session_1', 'secret')

    expect(readOpaqueSessionToken(token, 'secret')?.sessionId).toBe('session_1')
    expect(readOpaqueSessionToken(`${token}x`, 'secret')).toBeUndefined()
  })

  it('derives csrf tokens from session ids and secret', () => {
    expect(createCsrfToken('session_1', 'secret')).toBe(createCsrfToken('session_1', 'secret'))
    expect(createCsrfToken('session_1', 'secret')).not.toBe(createCsrfToken('session_2', 'secret'))
  })

  it('rejects expired or revoked database-backed sessions', () => {
    const token = createOpaqueSessionToken('session_1', 'secret')

    expect(readDbBackedSession({
      token,
      sessionSecret: 'secret',
      method: 'GET',
      now: '2026-05-19T12:00:00.000Z',
      sessions: {
        getSession: () => ({
          id: 'session_1',
          keyId: 'key_1',
          csrfHash: 'csrf',
          expiresAt: '2026-05-19T11:00:00.000Z',
          revokedAt: null,
        }),
      },
    })).toMatchObject({ ok: false, statusCode: 401 })

    expect(readDbBackedSession({
      token,
      sessionSecret: 'secret',
      method: 'GET',
      now: '2026-05-19T10:00:00.000Z',
      sessions: {
        getSession: () => ({
          id: 'session_1',
          keyId: 'key_1',
          csrfHash: 'csrf',
          expiresAt: '2026-05-19T11:00:00.000Z',
          revokedAt: '2026-05-19T09:00:00.000Z',
        }),
      },
    })).toMatchObject({ ok: false, statusCode: 401 })
  })

  it('requires csrf for mutating database-backed session requests', () => {
    const token = createOpaqueSessionToken('session_1', 'secret')

    const result = readDbBackedSession({
      token,
      sessionSecret: 'secret',
      method: 'POST',
      now: '2026-05-19T10:00:00.000Z',
      sessions: {
        getSession: () => ({
          id: 'session_1',
          keyId: 'key_1',
          csrfHash: 'csrf',
          expiresAt: '2026-05-19T11:00:00.000Z',
          revokedAt: null,
        }),
      },
    })

    expect(result).toMatchObject({ ok: false, statusCode: 403 })
    expect(readDbBackedSession({
      token,
      sessionSecret: 'secret',
      method: 'POST',
      csrfHeader: 'csrf',
      now: '2026-05-19T10:00:00.000Z',
      sessions: {
        getSession: () => ({
          id: 'session_1',
          keyId: 'key_1',
          csrfHash: 'csrf',
          expiresAt: '2026-05-19T11:00:00.000Z',
          revokedAt: null,
        }),
      },
    })).toMatchObject({ ok: true, keyId: 'key_1' })
  })
})
