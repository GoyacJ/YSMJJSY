import { nanoid } from 'nanoid'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { createAgentWorkRepository, createKeyDesignRepository, type AgentWorkRecord, type KeyDesignRecord } from '../../db/sqlite'
import type { StarPageDesignSchema } from '../../../types/design-schema'
import { parseDesignSchema } from '../../services/design-schema'
import { markKeyActivity } from '../../services/key-activity'

const commitBodySchema = z.object({
  schema: z.unknown(),
  prompt: z.string().trim().max(800).default(''),
})

export function getNextDesignVersion(latest: Pick<KeyDesignRecord, 'version'> | undefined) {
  return latest ? latest.version + 1 : 1
}

export function buildDesignCommitResponse(version: number) {
  return { ok: true, version }
}

export function buildWorkFromCommittedDesign(input: {
  keyId: string
  version: number
  schema: StarPageDesignSchema
  prompt: string
  now: string
}): AgentWorkRecord {
  return {
    id: nanoid(),
    keyId: input.keyId,
    type: 'page_design',
    title: input.schema.title || `页面设计 v${input.version}`,
    summary: input.prompt || '保存了一版页面设计。',
    sourceConversationId: null,
    sourceMediaTaskId: null,
    sourceDesignVersion: input.version,
    previewUrl: null,
    payloadJson: JSON.stringify(input.schema),
    visibility: 'private',
    createdAt: input.now,
    updatedAt: input.now,
  }
}

export default defineEventHandler(async (event) => {
  const keyId = event.context.keyId

  if (!keyId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = commitBodySchema.safeParse(await readBody(event))

  if (!body.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid design schema' })
  }

  let schema

  try {
    schema = parseDesignSchema(body.data.schema)
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid design schema' })
  }

  const config = useRuntimeConfig(event)
  const repo = createKeyDesignRepository(config.sqlitePath)
  const version = getNextDesignVersion(repo.getLatestDesign(keyId))
  const now = new Date().toISOString()

  repo.addKeyDesign({
    keyId,
    version,
    schemaJson: JSON.stringify(schema),
    prompt: body.data.prompt,
    createdAt: now,
  })
  createAgentWorkRepository(config.sqlitePath).addWork(buildWorkFromCommittedDesign({
    keyId,
    version,
    schema,
    prompt: body.data.prompt,
    now,
  }))
  markKeyActivity(config.sqlitePath, keyId, 'design')

  return buildDesignCommitResponse(version)
})
