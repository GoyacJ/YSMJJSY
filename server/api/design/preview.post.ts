import { createError, defineEventHandler, getRequestHeader, readBody } from 'h3'
import { z } from 'zod'
import {
  createKeyDesignRepository,
  createKeyProfileRepository,
  createUsageLimitRepository,
} from '../../db/sqlite'
import { createDefaultDesignSchema, parseDesignSchema } from '../../services/design-schema'
import { createIpHash } from '../../services/key-access'
import { createDefaultAgentModelProvider } from '../../services/agent-providers'
import { assertWithinLimit, usageLimits } from '../../services/rate-limit'
import { withMiniMaxErrorBoundary } from '../../services/api-errors'

const previewBodySchema = z.object({
  instruction: z.string().trim().min(1).max(800),
})

export function parsePreviewInstruction(input: unknown) {
  const result = previewBodySchema.safeParse(input)

  if (!result.success) {
    throw new Error('Invalid design instruction')
  }

  return result.data.instruction
}

function getClientIp(event: Parameters<typeof getRequestHeader>[0]) {
  return getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || getRequestHeader(event, 'x-real-ip')
    || event.node.req.socket.remoteAddress
    || 'unknown'
}

export default defineEventHandler(async (event) => {
  const keyId = event.context.keyId

  if (!keyId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  let instruction: string

  try {
    instruction = parsePreviewInstruction(await readBody(event))
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid design instruction' })
  }

  const config = useRuntimeConfig(event)
  const usage = createUsageLimitRepository(config.sqlitePath)
  const today = new Date().toISOString().slice(0, 10)
  const currentUsage = usage.getUsage(keyId, today)

  if (!assertWithinLimit({ current: currentUsage?.designCount ?? 0, max: usageLimits.designPerKeyPerDay })) {
    throw createError({ statusCode: 429, statusMessage: '今天的星光先到这里。' })
  }

  usage.incrementUsage({
    keyId,
    ipHash: createIpHash(getClientIp(event), config.sessionSecret),
    date: today,
    bucket: 'design',
  })

  const designs = createKeyDesignRepository(config.sqlitePath)
  const latest = designs.getLatestDesign(keyId)
  const currentSchema = latest
    ? parseDesignSchema(JSON.parse(latest.schemaJson))
    : createDefaultDesignSchema()
  const profile = createKeyProfileRepository(config.sqlitePath).getKeyProfile(keyId)
  const provider = createDefaultAgentModelProvider({
    minimaxApiKey: config.minimaxApiKey,
    minimaxGroupId: config.minimaxGroupId,
  })
  const generated = await withMiniMaxErrorBoundary(
    () => provider.generateDesignPatch({
      currentSchema,
      instruction,
      assistantName: profile?.assistantName || '星信',
      mbti: profile?.mbti || 'INTJ',
    }),
    'Design generation failed',
  )

  return {
    schema: parseDesignSchema(generated),
  }
})
