import { createError, defineEventHandler } from 'h3'
import { createKeyDesignRepository } from '../db/sqlite'
import { createDefaultDesignSchema, parseDesignSchema } from '../services/design-schema'

export default defineEventHandler((event) => {
  const keyId = event.context.keyId

  if (!keyId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const config = useRuntimeConfig(event)
  const latest = createKeyDesignRepository(config.sqlitePath).getLatestDesign(keyId)

  if (!latest) {
    return {
      schema: createDefaultDesignSchema(),
      version: 1,
    }
  }

  return {
    schema: parseDesignSchema(JSON.parse(latest.schemaJson)),
    version: latest.version,
  }
})
