import { z } from 'zod'
import { createSessionToken, getSessionCookieName, isValidUnlockCode } from '../services/session'

const unlockBodySchema = z.object({
  code: z.string().min(1).max(32),
})

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const body = unlockBodySchema.safeParse(await readBody(event))

  if (!body.success || !isValidUnlockCode(body.data.code, config.unlockCode || '100522')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid unlock code',
    })
  }

  setCookie(event, getSessionCookieName(), createSessionToken(config.sessionSecret), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 12,
    path: '/',
  })

  return { ok: true }
})
