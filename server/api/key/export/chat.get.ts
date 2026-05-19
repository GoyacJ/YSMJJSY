import { createError, defineEventHandler } from 'h3'
import { createConversationRepository } from '../../../db/sqlite'

export default defineEventHandler((event) => {
  const keyId = event.context.keyId

  if (!keyId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const config = useRuntimeConfig(event)
  const conversations = createConversationRepository(config.sqlitePath)
    .listConversationsByKey(keyId)
    .map(record => ({
      id: record.id,
      role: record.role,
      content: record.content,
      createdAt: record.createdAt,
    }))

  return {
    exportedAt: new Date().toISOString(),
    conversations,
  }
})
