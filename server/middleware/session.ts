import { getSessionCookieName, isValidSessionToken } from '../services/session'

export default defineEventHandler((event) => {
  const path = event.path.split('?')[0]

  if (!path.startsWith('/api/') || path === '/api/unlock') {
    return
  }

  const config = useRuntimeConfig(event)
  const token = getCookie(event, getSessionCookieName())

  if (!isValidSessionToken(token, config.sessionSecret)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }
})
