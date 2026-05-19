import { createError, defineEventHandler } from 'h3'
import { createMemoryRepository } from '../../../db/sqlite'

export default defineEventHandler((event) => {
  const keyId = event.context.keyId

  if (!keyId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const config = useRuntimeConfig(event)
  const memories = createMemoryRepository(config.sqlitePath)
    .listMemoriesByKey(keyId)
    .map(memory => ({
      id: memory.id,
      type: memory.type,
      content: memory.content,
      importance: memory.importance,
      confidence: memory.confidence ?? 1,
      sourceConversationId: memory.sourceConversationId ?? null,
      sourceAttachmentId: memory.sourceAttachmentId ?? null,
      status: memory.status ?? 'active',
      updatedAt: memory.updatedAt ?? null,
      createdAt: memory.createdAt,
    }))

  return {
    exportedAt: new Date().toISOString(),
    memories,
  }
})
