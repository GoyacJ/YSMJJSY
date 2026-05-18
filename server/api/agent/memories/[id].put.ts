import { nanoid } from 'nanoid'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import {
  createAgentEventRepository,
  createAgentInstanceRepository,
  createAgentObservationRepository,
  createMemoryEventRepository,
  createMemoryRepository,
  type AgentEventRecord,
  type AgentObservationRecord,
  type MemoryEventRecord,
  type MemoryGovernanceAction,
  type MemoryRecord,
} from '../../../db/sqlite'
import { buildAgentEvent } from '../../../services/agent-events'
import { createAgentToolRegistry, type AgentToolRegistry } from '../../../services/agent-runtime'
import { registerStarAgentTools } from '../../../services/star-agent-tools'
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

export function recordMemoryGovernanceObservation(input: {
  agentId: string
  memoryId: string
  action: MemoryGovernanceAction
  now: string
  observations: { addObservation: (record: AgentObservationRecord) => void }
  events: { addEvent: (record: AgentEventRecord) => void }
}) {
  const observationId = `observation_${nanoid()}`

  input.observations.addObservation({
    id: observationId,
    agentId: input.agentId,
    sourceType: 'memory',
    sourceId: input.memoryId,
    summary: `记忆治理动作：${input.action}`,
    payloadJson: JSON.stringify({ memoryId: input.memoryId, action: input.action }),
    createdAt: input.now,
  })
  input.events.addEvent(buildAgentEvent({
    id: `event_${nanoid()}`,
    agentId: input.agentId,
    type: 'observation.created',
    title: '观察记录',
    summary: '记忆治理已记录。',
    targetType: 'observation',
    targetId: observationId,
    payload: { memoryId: input.memoryId, action: input.action },
    createdAt: input.now,
  }))
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

export async function governMemoryWithTool(input: {
  toolName: 'star.governMemory'
  memoryId: string
  action: MemoryGovernanceAction
  reason: string
  registry: Pick<AgentToolRegistry, 'execute'>
}) {
  const payload = {
    memoryId: input.memoryId,
    action: input.action,
    reason: input.reason,
  }
  const result = await input.registry.execute(input.toolName, payload)

  if (!result.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: result.error ?? 'Memory governance failed',
    })
  }

  return result.output as { id: string, status: string, importance?: number }
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
  const now = new Date().toISOString()

  const memories = createMemoryRepository(config.sqlitePath)
  const memoryEvents = createMemoryEventRepository(config.sqlitePath)
  const registry = createAgentToolRegistry()

  registerStarAgentTools(registry, {
    keyId,
    now,
    memories,
    memoryEvents,
  })

  const result = await governMemoryWithTool({
    toolName: 'star.governMemory',
    memoryId,
    action: body.action,
    reason: body.reason,
    registry,
  })

  try {
    const agent = createAgentInstanceRepository(config.sqlitePath).getOrCreateAgentForOwner({
      ownerType: 'key',
      ownerId: keyId,
      domain: 'star',
      now,
    })

    recordMemoryGovernanceObservation({
      agentId: agent.id,
      memoryId,
      action: body.action,
      now,
      observations: createAgentObservationRepository(config.sqlitePath),
      events: createAgentEventRepository(config.sqlitePath),
    })
  }
  catch {
    // Observation capture is secondary.
  }

  return result
})
