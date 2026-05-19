import { createHmac, timingSafeEqual } from 'node:crypto'

export function isValidUnlockCode(input: string, expected: string) {
  return input.trim() === expected.trim()
}

export function getSessionCookieName() {
  return 'letter_session'
}

export function getCsrfCookieName() {
  return 'letter_csrf'
}

export function assertProductionSessionSecret(sessionSecret: string | undefined) {
  if (process.env.NODE_ENV === 'production' && (!sessionSecret || sessionSecret === 'dev-secret')) {
    throw new Error('NUXT_SESSION_SECRET must be set in production')
  }
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

export function createOpaqueSessionToken(sessionId: string, sessionSecret: string) {
  const secret = sessionSecret || 'dev-secret'
  const signature = createHmac('sha256', secret).update(sessionId).digest('hex')

  return `${sessionId}.${signature}`
}

export function readOpaqueSessionToken(token: string | undefined, sessionSecret: string) {
  if (!token) {
    return undefined
  }

  const [sessionId, signature] = token.split('.')

  if (!sessionId || !signature) {
    return undefined
  }

  const expected = createOpaqueSessionToken(sessionId, sessionSecret)
  const tokenBuffer = Buffer.from(token)
  const expectedBuffer = Buffer.from(expected)

  if (tokenBuffer.length !== expectedBuffer.length) {
    return undefined
  }

  return timingSafeEqual(tokenBuffer, expectedBuffer) ? { sessionId } : undefined
}

export function createCsrfToken(sessionId: string, sessionSecret: string) {
  return createHmac('sha256', sessionSecret || 'dev-secret')
    .update(`csrf:${sessionId}`)
    .digest('hex')
}

export function requiresCsrfForMethod(method: string) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
}

export function readDbBackedSession(input: {
  token: string | undefined
  sessionSecret: string
  method: string
  csrfHeader?: string
  now: string
  sessions: {
    getSession: (id: string) => {
      id: string
      keyId: string
      csrfHash: string
      expiresAt: string
      revokedAt?: string | null
    } | undefined
  }
}) {
  const opaque = readOpaqueSessionToken(input.token, input.sessionSecret)

  if (!opaque) {
    return undefined
  }

  const session = input.sessions.getSession(opaque.sessionId)

  if (!session || session.revokedAt || session.expiresAt <= input.now) {
    return {
      ok: false as const,
      statusCode: 401,
      statusMessage: 'Unauthorized',
    }
  }

  if (requiresCsrfForMethod(input.method)) {
    const expected = session.csrfHash || createCsrfToken(session.id, input.sessionSecret)

    if (input.csrfHeader !== expected) {
      return {
        ok: false as const,
        statusCode: 403,
        statusMessage: 'Invalid CSRF token',
      }
    }
  }

  return {
    ok: true as const,
    keyId: session.keyId,
    sessionId: session.id,
  }
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
