import { createError, defineEventHandler, getCookie, getHeader } from 'h3'
import { createKeySessionRepository } from '../db/sqlite'
import {
  assertProductionSessionSecret,
  getSessionCookieName,
  readDbBackedSession,
  readKeySessionToken,
} from '../services/session'

function isPublicApiPath(path: string) {
  return (
    !path.startsWith('/api/')
    || path === '/api/unlock'
    || path === '/api/keys'
    || path === '/api/public-stars'
  )
}

export default defineEventHandler((event) => {
  const path = event.path.split('?')[0]

  if (isPublicApiPath(path)) {
    return
  }

  const config = useRuntimeConfig(event)
  const secret = config.sessionSecret || 'dev-secret'
  assertProductionSessionSecret(config.sessionSecret)

  const token = getCookie(event, getSessionCookieName())
  const session = readDbBackedSession({
    token,
    sessionSecret: secret,
    method: event.method,
    csrfHeader: getHeader(event, 'x-letter-csrf'),
    now: new Date().toISOString(),
    sessions: createKeySessionRepository(config.sqlitePath),
  })

  if (session?.ok) {
    event.context.keyId = session.keyId
    event.context.sessionId = session.sessionId
    return
  }

  if (session && !session.ok) {
    throw createError({
      statusCode: session.statusCode,
      statusMessage: session.statusMessage,
    })
  }

  const legacySession = readKeySessionToken(token, secret)

  if (!legacySession) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  event.context.keyId = legacySession.keyId
})
