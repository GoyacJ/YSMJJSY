import { createError, defineEventHandler, readBody } from 'h3'
import { createConversationRepository } from '../../../db/sqlite'

export default defineEventHandler(async (event) => {
  const keyId = event.context.keyId

  if (!keyId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event) as { confirm?: unknown }

  if (!body || body.confirm !== 'DELETE') {
    throw createError({ statusCode: 400, statusMessage: 'Delete confirmation required' })
  }

  const config = useRuntimeConfig(event)
  const deleted = createConversationRepository(config.sqlitePath).clearConversationsByKey(keyId)

  return { deleted }
})
