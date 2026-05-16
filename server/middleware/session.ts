import { getSessionCookieName, readKeySessionToken } from '../services/session'

export default defineEventHandler((event) => {
  const path = event.path.split('?')[0]

  if (
    !path.startsWith('/api/')
    || path === '/api/unlock'
    || path === '/api/keys'
    || path === '/api/public-stars'
  ) {
    return
  }

  const config = useRuntimeConfig(event)
  const token = getCookie(event, getSessionCookieName())
  const session = readKeySessionToken(token, config.sessionSecret)

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  event.context.keyId = session.keyId
})
