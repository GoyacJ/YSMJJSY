import { nanoid } from 'nanoid'
import { createError, defineEventHandler, getRequestHeader, readBody, setCookie, type H3Event } from 'h3'
import { z } from 'zod'
import {
  createKeyDesignRepository,
  createKeyProfileRepository,
  createKeySessionRepository,
  createUsageLimitRepository,
  defaultStarBoundarySettings,
  normalizeStarBoundarySettings,
} from '../db/sqlite'
import { createIpHash, createKeyLookupHash, normalizeKey } from '../services/key-access'
import { assertWithinLimit, usageLimits } from '../services/rate-limit'
import {
  createCsrfToken,
  createOpaqueSessionToken,
  getCsrfCookieName,
  getSessionCookieName,
} from '../services/session'
import { createDefaultDesignSchema } from '../services/design-schema'

const PUBLIC_CREATE_KEY_ID = '__public_create__'

const boundarySettingsSchema = z.object({
  memoryWriteMode: z.enum(['manual', 'assisted', 'auto']).default(defaultStarBoundarySettings.memoryWriteMode),
  generatedWorksDefaultVisibility: z.enum(['private', 'public']).default(defaultStarBoundarySettings.generatedWorksDefaultVisibility),
  requireApprovalForPublishing: z.boolean().default(defaultStarBoundarySettings.requireApprovalForPublishing),
  requireApprovalForPersonaChange: z.boolean().default(defaultStarBoundarySettings.requireApprovalForPersonaChange),
  requireApprovalForSensitiveMemory: z.boolean().default(defaultStarBoundarySettings.requireApprovalForSensitiveMemory),
  disallowedMemoryTopics: z.array(z.string().trim().min(1).max(80)).max(30).default(defaultStarBoundarySettings.disallowedMemoryTopics),
  allowedMemoryTopics: z.array(z.string().trim().min(1).max(80)).max(30).default(defaultStarBoundarySettings.allowedMemoryTopics),
  minorMode: z.boolean().default(defaultStarBoundarySettings.minorMode),
}).strict()

const createKeyBodySchema = z.object({
  key: z.string().trim().min(6).max(64),
  boundarySettings: boundarySettingsSchema.default(defaultStarBoundarySettings),
}).transform(value => ({
  ...value,
  boundarySettings: normalizeStarBoundarySettings(value.boundarySettings),
}))

export { defaultStarBoundarySettings }

export function parseCreateKeyBody(input: unknown) {
  const body = createKeyBodySchema.safeParse(input)

  if (!body.success) {
    throw new Error('Invalid key')
  }

  return body.data
}

export function buildCreatedKeyResponse(keyId: string) {
  return {
    ok: true,
    keyId,
    needsConfig: true,
  }
}

export function createDefaultDesignSchemaJson() {
  return JSON.stringify(createDefaultDesignSchema())
}

function getClientIp(event: H3Event) {
  return getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || getRequestHeader(event, 'x-real-ip')
    || event.node.req.socket.remoteAddress
    || 'unknown'
}

function getDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function getMinuteKey(date = new Date()) {
  return date.toISOString().slice(0, 16)
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  let body: z.infer<typeof createKeyBodySchema>

  try {
    body = parseCreateKeyBody(await readBody(event))
  }
  catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid key',
    })
  }

  let normalizedKey: string

  try {
    normalizedKey = normalizeKey(body.key)
  }
  catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid key',
    })
  }

  const secret = config.sessionSecret || 'dev-secret'
  const now = new Date()
  const nowIso = now.toISOString()
  const ipHash = createIpHash(getClientIp(event), secret)
  const lookupHash = createKeyLookupHash(normalizedKey, secret)
  const profiles = createKeyProfileRepository(config.sqlitePath)
  const usage = createUsageLimitRepository(config.sqlitePath)

  if (profiles.findByLookupHash(lookupHash)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Key already exists',
    })
  }

  const dayUsage = usage.getUsageByIp(PUBLIC_CREATE_KEY_ID, ipHash, getDateKey(now))
  const minuteUsage = usage.getUsageByIp(PUBLIC_CREATE_KEY_ID, ipHash, getMinuteKey(now))

  if (
    !assertWithinLimit({ current: dayUsage?.createCount ?? 0, max: usageLimits.createPerIpPerDay })
    || !assertWithinLimit({ current: minuteUsage?.createCount ?? 0, max: usageLimits.createPerIpPerMinute })
  ) {
    throw createError({
      statusCode: 429,
      statusMessage: '今天的星光先到这里。',
    })
  }

  const keyId = `key_${nanoid()}`

  profiles.addKeyProfile({
    id: keyId,
    keyLookupHash: lookupHash,
    assistantName: '',
    mbti: '',
    configuredAt: null,
    createdIpHash: ipHash,
    createdAt: nowIso,
    updatedAt: nowIso,
    boundarySettings: body.boundarySettings,
  })
  createKeyDesignRepository(config.sqlitePath).addKeyDesign({
    keyId,
    version: 1,
    schemaJson: createDefaultDesignSchemaJson(),
    prompt: 'default',
    createdAt: nowIso,
  })
  usage.incrementUsage({
    keyId: PUBLIC_CREATE_KEY_ID,
    ipHash,
    date: getDateKey(now),
    bucket: 'create',
  })
  usage.incrementUsage({
    keyId: PUBLIC_CREATE_KEY_ID,
    ipHash,
    date: getMinuteKey(now),
    bucket: 'create',
  })

  const sessionId = `session_${nanoid()}`
  const csrf = createCsrfToken(sessionId, secret)

  createKeySessionRepository(config.sqlitePath).addSession({
    id: sessionId,
    keyId,
    csrfHash: csrf,
    createdAt: nowIso,
    expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 12).toISOString(),
    revokedAt: null,
  })

  setCookie(event, getSessionCookieName(), createOpaqueSessionToken(sessionId, secret), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 12,
    path: '/',
  })
  setCookie(event, getCsrfCookieName(), csrf, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 12,
    path: '/',
  })

  return buildCreatedKeyResponse(keyId)
})
