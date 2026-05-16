import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { createKeyProfileRepository } from '../../db/sqlite'

export const mbtiValues = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
] as const

const profileUpdateSchema = z.object({
  assistantName: z.string().trim().min(1).max(24),
  mbti: z.enum(mbtiValues),
})

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>

export function parseProfileUpdate(input: unknown): ProfileUpdateInput {
  const result = profileUpdateSchema.safeParse(input)

  if (!result.success) {
    throw new Error('Invalid profile')
  }

  return result.data
}

export function resolveProfileActivityKind(configuredAt?: string | null) {
  return configuredAt ? 'profile' : 'created'
}

export default defineEventHandler(async (event) => {
  const keyId = event.context.keyId

  if (!keyId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  let body: ProfileUpdateInput

  try {
    body = parseProfileUpdate(await readBody(event))
  }
  catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid profile',
    })
  }

  const config = useRuntimeConfig(event)
  const repo = createKeyProfileRepository(config.sqlitePath)
  const now = new Date().toISOString()
  const current = repo.getKeyProfile(keyId)
  const activityKind = resolveProfileActivityKind(current?.configuredAt)

  repo.updateKeyProfile(keyId, {
    assistantName: body.assistantName,
    mbti: body.mbti,
    configuredAt: now,
    updatedAt: now,
  })
  repo.markKeyActivity(keyId, {
    activityAt: now,
    activityKind,
  })

  return {
    keyId,
    assistantName: body.assistantName,
    mbti: body.mbti,
    configured: true,
  }
})
