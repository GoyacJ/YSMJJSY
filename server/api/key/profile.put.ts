import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { createKeyProfileRepository, defaultStarBoundarySettings, normalizeStarBoundarySettings } from '../../db/sqlite'

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
  boundarySettings: z.object({
    memoryWriteMode: z.enum(['manual', 'assisted', 'auto']).default(defaultStarBoundarySettings.memoryWriteMode),
    generatedWorksDefaultVisibility: z.enum(['private', 'public']).default(defaultStarBoundarySettings.generatedWorksDefaultVisibility),
    requireApprovalForPublishing: z.boolean().default(defaultStarBoundarySettings.requireApprovalForPublishing),
    requireApprovalForPersonaChange: z.boolean().default(defaultStarBoundarySettings.requireApprovalForPersonaChange),
    requireApprovalForSensitiveMemory: z.boolean().default(defaultStarBoundarySettings.requireApprovalForSensitiveMemory),
    disallowedMemoryTopics: z.array(z.string().trim().min(1).max(80)).max(30).default(defaultStarBoundarySettings.disallowedMemoryTopics),
    allowedMemoryTopics: z.array(z.string().trim().min(1).max(80)).max(30).default(defaultStarBoundarySettings.allowedMemoryTopics),
    minorMode: z.boolean().default(defaultStarBoundarySettings.minorMode),
  }).strict().optional(),
}).transform(value => ({
  ...value,
  boundarySettings: value.boundarySettings ? normalizeStarBoundarySettings(value.boundarySettings) : undefined,
}))

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
    boundarySettings: body.boundarySettings ?? current?.boundarySettings,
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
    boundarySettings: body.boundarySettings ?? current?.boundarySettings ?? defaultStarBoundarySettings,
  }
})
