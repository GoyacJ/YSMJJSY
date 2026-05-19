import { nanoid } from 'nanoid'
import { createError, defineEventHandler, readBody } from 'h3'
import { createMemoryEventRepository, createMemoryRepository } from '../../../db/sqlite'

function serializeDeletedMemory(memory: { importance: number, status?: string | null }) {
  return JSON.stringify({
    importance: memory.importance,
    status: memory.status ?? 'active',
    deleted: true,
  })
}

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
  const now = new Date().toISOString()
  const memories = createMemoryRepository(config.sqlitePath)
  const memoryEvents = createMemoryEventRepository(config.sqlitePath)
  const records = memories.listMemoriesByKey(keyId)

  for (const memory of records) {
    const beforeJson = JSON.stringify({
      importance: memory.importance,
      status: memory.status ?? 'active',
    })

    memoryEvents.addMemoryEvent({
      id: `memory_event_${nanoid()}`,
      keyId,
      memoryId: memory.id,
      action: 'delete',
      beforeJson,
      afterJson: serializeDeletedMemory(memory),
      reason: '用户清空记忆。',
      createdAt: now,
    })
  }

  const deleted = memories.clearMemoriesByKey(keyId)

  return { deleted }
})
