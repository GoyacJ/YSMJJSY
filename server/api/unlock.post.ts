import { z } from 'zod'
import { nanoid } from 'nanoid'
import { getRequestHeader } from 'h3'
import { createKeyDesignRepository, createKeyProfileRepository } from '../db/sqlite'
import { createIpHash, createKeyLookupHash, normalizeKey } from '../services/key-access'
import { createKeySessionToken, getSessionCookieName, isValidUnlockCode } from '../services/session'
import { createDefaultDesignSchemaJson } from './keys.post'

const unlockBodySchema = z.object({
  code: z.string().min(1).max(80),
})

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const body = unlockBodySchema.safeParse(await readBody(event))
  const expectedUnlockCode = process.env.NUXT_UNLOCK_CODE || config.unlockCode || '100522'

  if (!body.success) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid unlock code',
    })
  }

  let normalizedKey: string

  try {
    normalizedKey = normalizeKey(body.data.code)
  }
  catch {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid unlock code',
    })
  }

  const secret = config.sessionSecret || 'dev-secret'
  const lookupHash = createKeyLookupHash(normalizedKey, secret)
  const profiles = createKeyProfileRepository(config.sqlitePath)
  let profile = profiles.findByLookupHash(lookupHash)

  if (!profile && isValidUnlockCode(normalizedKey, expectedUnlockCode)) {
    const now = new Date().toISOString()
    const ip = getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
      || getRequestHeader(event, 'x-real-ip')
      || event.node.req.socket.remoteAddress
      || 'unknown'
    const keyId = `key_${nanoid()}`

    profiles.addKeyProfile({
      id: keyId,
      keyLookupHash: lookupHash,
      assistantName: '',
      mbti: '',
      configuredAt: null,
      createdIpHash: createIpHash(ip, secret),
      createdAt: now,
      updatedAt: now,
    })
    createKeyDesignRepository(config.sqlitePath).addKeyDesign({
      keyId,
      version: 1,
      schemaJson: createDefaultDesignSchemaJson(),
      prompt: 'legacy unlock default',
      createdAt: now,
    })
    profile = profiles.getKeyProfile(keyId)
  }

  if (!profile) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid unlock code',
    })
  }

  setCookie(event, getSessionCookieName(), createKeySessionToken(profile.id, secret), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 12,
    path: '/',
  })

  return {
    ok: true,
    keyId: profile.id,
    needsConfig: !profile.configuredAt,
  }
})
