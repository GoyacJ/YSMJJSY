import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { createKeyDesignRepository, type KeyDesignRecord } from '../../db/sqlite'
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

  repo.addKeyDesign({
    keyId,
    version,
    schemaJson: JSON.stringify(schema),
    prompt: body.data.prompt,
    createdAt: new Date().toISOString(),
  })
  markKeyActivity(config.sqlitePath, keyId, 'design')

  return buildDesignCommitResponse(version)
})
