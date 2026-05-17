import { nanoid } from 'nanoid'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import {
  createMemoryEventRepository,
  createMemoryRepository,
  type MemoryEventRecord,
  type MemoryGovernanceAction,
  type MemoryRecord,
} from '../../../db/sqlite'
import { requireAgentKey } from '../core.get'

type MemoryGovernanceInput = {
  keyId: string
  memoryId: string
  action: MemoryGovernanceAction
  reason: string
  now: string
  memories: {
    getMemoryByKey: (keyId: string, id: string) => MemoryRecord | undefined
    updateMemory: (id: string, updates: { importance?: number, status?: 'active' | 'archived' | 'rejected', updatedAt: string }) => void
  }
  events: {
    addMemoryEvent: (record: MemoryEventRecord) => void
  }
}

function serializeMemoryGovernanceState(memory: MemoryRecord) {
  return JSON.stringify({
    importance: memory.importance,
    status: memory.status ?? 'active',
  })
}

export function applyMemoryGovernanceAction(input: MemoryGovernanceInput) {
  const memory = input.memories.getMemoryByKey(input.keyId, input.memoryId)

  if (!memory) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Memory not found',
    })
  }

  const beforeJson = serializeMemoryGovernanceState(memory)
  const nextMemory = { ...memory }

  if (input.action === 'downgrade') {
    nextMemory.importance = Math.max(0, memory.importance - 0.2)
    input.memories.updateMemory(memory.id, {
      importance: nextMemory.importance,
      updatedAt: input.now,
    })
  }
  else if (input.action === 'archive') {
    nextMemory.status = 'archived'
    input.memories.updateMemory(memory.id, {
      status: 'archived',
      updatedAt: input.now,
    })
  }
  else if (input.action === 'reject') {
    nextMemory.status = 'rejected'
    input.memories.updateMemory(memory.id, {
      status: 'rejected',
      updatedAt: input.now,
    })
  }

  input.events.addMemoryEvent({
    id: nanoid(),
    keyId: input.keyId,
    memoryId: input.memoryId,
    action: input.action,
    beforeJson,
    afterJson: serializeMemoryGovernanceState(nextMemory),
    reason: input.reason,
    createdAt: input.now,
  })

  return {
    id: input.memoryId,
    status: nextMemory.status ?? 'active',
    importance: nextMemory.importance,
  }
}

function parseMemoryGovernanceBody(body: unknown) {
  if (body && typeof body === 'object') {
    const input = body as { action?: unknown, reason?: unknown }

    if (
      input.action === 'confirm'
      || input.action === 'downgrade'
      || input.action === 'archive'
      || input.action === 'reject'
    ) {
      return {
        action: input.action,
        reason: typeof input.reason === 'string' ? input.reason : '',
      }
    }
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Invalid memory governance action',
  })
}

export default defineEventHandler(async (event) => {
  const keyId = requireAgentKey(event)
  const memoryId = getRouterParam(event, 'id')

  if (!memoryId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing memory id',
    })
  }

  const body = parseMemoryGovernanceBody(await readBody(event))
  const config = useRuntimeConfig(event)

  return applyMemoryGovernanceAction({
    keyId,
    memoryId,
    action: body.action,
    reason: body.reason,
    now: new Date().toISOString(),
    memories: createMemoryRepository(config.sqlitePath),
    events: createMemoryEventRepository(config.sqlitePath),
  })
})
