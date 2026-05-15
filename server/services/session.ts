import { createHmac, timingSafeEqual } from 'node:crypto'

export function isValidUnlockCode(input: string, expected: string) {
  return input.trim() === expected.trim()
}

export function getSessionCookieName() {
  return 'letter_session'
}

export function createSessionToken(sessionSecret: string) {
  return sessionSecret ? `unlocked.${sessionSecret.slice(0, 12)}` : 'unlocked'
}

export function isValidSessionToken(token: string | undefined, sessionSecret: string) {
  return token === createSessionToken(sessionSecret)
}

export function createKeySessionToken(keyId: string, sessionSecret: string) {
  const secret = sessionSecret || 'dev-secret'
  const signature = createHmac('sha256', secret).update(keyId).digest('hex')

  return `${keyId}.${signature}`
}

export function readKeySessionToken(token: string | undefined, sessionSecret: string) {
  if (!token) {
    return undefined
  }

  const [keyId, signature] = token.split('.')

  if (!keyId || !signature) {
    return undefined
  }

  const expected = createKeySessionToken(keyId, sessionSecret)
  const tokenBuffer = Buffer.from(token)
  const expectedBuffer = Buffer.from(expected)

  if (tokenBuffer.length !== expectedBuffer.length) {
    return undefined
  }

  return timingSafeEqual(tokenBuffer, expectedBuffer) ? { keyId } : undefined
}
