import { nanoid } from 'nanoid'
import { createError, defineEventHandler, getRouterParam, type H3Event } from 'h3'
import {
  createAgentEventRepository,
  createAgentEvolutionRepository,
  createAgentInstanceRepository,
  createAgentTaskRepository,
  createMemoryEventRepository,
  createAgentSnapshotRepository,
  createAgentStateRepository,
  createAgentWorkRepository,
  createKeyProfileRepository,
  createMemoryRepository,
  type AgentEventRecord,
  type AgentEvolutionProposalRecord,
  type AgentStateRecord,
  type AgentStateSnapshotRecord,
  type AgentTaskRecord,
  type AgentWorkRecord,
  type AgentWorkVisibility,
  type MemoryEventRecord,
  type MemoryGovernanceAction,
  type MemoryRecord,
} from '../../../../../db/sqlite'
import { applyAgentProposalAction } from '../../../../agent/proposals/[id].put'
import { updateAgentWorkVisibilityAction } from '../../../../agent/works/[id].put'
import { requireAgentKey } from '../../../../agent/core.get'
import { buildAgentEvent } from '../../../../../services/agent-events'
import { applyMemoryGovernanceAction } from '../../../../agent/memories/[id].put'
import { defaultAgentPolicy } from '../../../../../services/agent-policy'
import { cancelAgentTask, runAgentTask } from '../../../../../services/agent-task-queue'
import { createAgentToolRegistry, type AgentToolRegistry } from '../../../../../services/agent-runtime'
import { registerStarAgentTools } from '../../../../../services/star-agent-tools'

export type InboxActionInput = {
  itemId: string
  keyId: string
  agentId: string
  now: string
  profile: {
    assistantName: string
    mbti: string
  }
  agentState: Pick<AgentStateRecord, 'tone' | 'relationshipRole' | 'learningMode' | 'contentStrategy'>
  proposals: {
    listProposalsByKey: (keyId: string) => AgentEvolutionProposalRecord[]
    updateProposal: (id: string, updates: Pick<AgentEvolutionProposalRecord, 'status' | 'updatedAt'>) => void
  }
  snapshots: {
    addSnapshot: (record: AgentStateSnapshotRecord) => void
  }
  states: {
    updateAgentState: (keyId: string, updates: Partial<Omit<AgentStateRecord, 'keyId'>> & { updatedAt: string }) => void
  }
  memories: {
    getMemoryByKey?: (keyId: string, id: string) => MemoryRecord | undefined
    updateMemory: (id: string, updates: { importance?: number, status?: 'active' | 'archived' | 'rejected', updatedAt: string }) => void
  }
  memoryEvents?: {
    addMemoryEvent: (record: MemoryEventRecord) => void
  }
  tasks?: {
    getTask: (id: string) => AgentTaskRecord | undefined
    updateTask: (id: string, updates: Partial<Pick<AgentTaskRecord, 'status' | 'resultJson' | 'error' | 'updatedAt'>>) => void
  }
  registry?: Pick<AgentToolRegistry, 'get' | 'execute'>
  works: {
    getWorkByKey: (keyId: string, id: string) => AgentWorkRecord | undefined
    updateWorkVisibility: (keyId: string, id: string, visibility: AgentWorkVisibility, updatedAt: string) => void
  }
  events: {
    addEvent: (record: AgentEventRecord) => void
  }
}

type ParsedInboxItem = {
  type: 'proposal' | 'work_visibility' | 'memory_governance' | 'task_approval' | 'rollback'
  id: string
  action?: string
}

export function parseInboxItemId(itemId: string): ParsedInboxItem {
  const separator = itemId.indexOf(':')

  if (separator === -1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid inbox item id',
    })
  }

  const type = itemId.slice(0, separator)
  const id = itemId.slice(separator + 1)

  if ((type === 'proposal' || type === 'work_visibility' || type === 'task_approval' || type === 'rollback') && id) {
    return { type, id }
  }

  if (type === 'memory_governance') {
    const [memoryId, action] = id.split(':')

    if (memoryId && action) {
      return { type, id: memoryId, action }
    }
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Invalid inbox item id',
  })
}

export function addApprovalEvent(input: InboxActionInput, parsed: ParsedInboxItem, approved: boolean) {
  input.events.addEvent(buildAgentEvent({
    id: `event_${nanoid()}`,
    agentId: input.agentId,
    type: approved ? 'approval.approved' : 'approval.rejected',
    title: approved ? '审批通过' : '审批拒绝',
    summary: approved ? '待办已通过。' : '待办已拒绝。',
    targetType: parsed.type === 'proposal'
      ? 'proposal'
      : parsed.type === 'work_visibility'
        ? 'work'
        : parsed.type === 'task_approval'
          ? 'task'
          : parsed.type === 'rollback'
            ? 'snapshot'
            : 'memory',
    targetId: parsed.id,
    payload: { itemId: input.itemId },
    createdAt: input.now,
  }))
}

export function approveAgentInboxItem(input: InboxActionInput) {
  const parsed = parseInboxItemId(input.itemId)

  if (parsed.type === 'proposal') {
    const result = applyAgentProposalAction({
      keyId: input.keyId,
      proposalId: parsed.id,
      action: 'accept',
      now: input.now,
      profile: input.profile,
      agentState: input.agentState,
      proposals: input.proposals,
      snapshots: input.snapshots,
      states: input.states,
      memories: input.memories,
    })

    if (!result) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Inbox item not found',
      })
    }

    addApprovalEvent(input, parsed, true)

    return {
      id: result.id,
      type: parsed.type,
      status: result.status,
    }
  }

  if (parsed.type === 'work_visibility') {
    updateAgentWorkVisibilityAction({
      keyId: input.keyId,
      workId: parsed.id,
      visibility: 'public',
      now: input.now,
      works: input.works,
    })
    addApprovalEvent(input, parsed, true)

    return {
      id: parsed.id,
      type: parsed.type,
      status: 'approved',
    }
  }

  if (parsed.type === 'memory_governance') {
    if (!input.memories.getMemoryByKey || !input.memoryEvents || !parsed.action) {
      throw createError({ statusCode: 400, statusMessage: 'Memory governance action unavailable' })
    }

    const result = applyMemoryGovernanceAction({
      keyId: input.keyId,
      memoryId: parsed.id,
      action: parsed.action as MemoryGovernanceAction,
      reason: 'Agent OS inbox approval',
      now: input.now,
      memories: {
        getMemoryByKey: input.memories.getMemoryByKey,
        updateMemory: input.memories.updateMemory,
      },
      events: input.memoryEvents,
    })
    addApprovalEvent(input, parsed, true)

    return {
      id: result.id,
      type: parsed.type,
      status: result.status,
    }
  }

  if (parsed.type === 'task_approval') {
    if (!input.tasks || !input.registry) {
      throw createError({ statusCode: 400, statusMessage: 'Task approval action unavailable' })
    }

    const task = input.tasks.getTask(parsed.id)

    if (!task || task.agentId !== input.agentId) {
      throw createError({ statusCode: 404, statusMessage: 'Task not found' })
    }

    return runAgentTask({
      task,
      now: input.now,
      tasks: input.tasks,
      events: input.events,
      registry: input.registry,
      policy: defaultAgentPolicy,
      approvalGranted: true,
    }).then(() => {
      addApprovalEvent(input, parsed, true)

      return {
        id: parsed.id,
        type: parsed.type,
        status: 'approved',
      }
    })
  }

  addApprovalEvent(input, parsed, true)

  return {
    id: parsed.id,
    type: parsed.type,
    status: 'approved',
  }
}

export function cancelTaskApproval(input: InboxActionInput, parsed: ParsedInboxItem) {
  if (!input.tasks) {
    throw createError({ statusCode: 400, statusMessage: 'Task approval action unavailable' })
  }

  const task = input.tasks.getTask(parsed.id)

  if (!task || task.agentId !== input.agentId) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  cancelAgentTask({
    task,
    now: input.now,
    tasks: input.tasks,
    events: input.events,
  })
}

export function approveWorkVisibility(input: InboxActionInput, parsed: ParsedInboxItem) {
  updateAgentWorkVisibilityAction({
    keyId: input.keyId,
    workId: parsed.id,
    visibility: 'public',
    now: input.now,
    works: input.works,
  })
  addApprovalEvent(input, parsed, true)

  return {
    id: parsed.id,
    type: parsed.type,
    status: 'approved',
  }
}

function buildRouteInput(event: H3Event, itemId: string): InboxActionInput {
  const keyId = requireAgentKey(event)
  const config = useRuntimeConfig(event)
  const now = new Date().toISOString()
  const profile = createKeyProfileRepository(config.sqlitePath).getKeyProfile(keyId)

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Profile not found',
    })
  }

  const states = createAgentStateRepository(config.sqlitePath)
  const agent = createAgentInstanceRepository(config.sqlitePath).getOrCreateAgentForOwner({
    ownerType: 'key',
    ownerId: keyId,
    domain: 'star',
    now,
  })

  return {
    itemId,
    keyId,
    agentId: agent.id,
    now,
    profile: {
      assistantName: profile.assistantName,
      mbti: profile.mbti,
    },
    agentState: states.getOrCreateAgentState(keyId, now),
    proposals: createAgentEvolutionRepository(config.sqlitePath),
    snapshots: createAgentSnapshotRepository(config.sqlitePath),
    states,
    memories: createMemoryRepository(config.sqlitePath),
    memoryEvents: createMemoryEventRepository(config.sqlitePath),
    works: createAgentWorkRepository(config.sqlitePath),
    tasks: createAgentTaskRepository(config.sqlitePath),
    events: createAgentEventRepository(config.sqlitePath),
    registry: createAgentToolRegistry(),
  }
}

export function buildAgentInboxActionRouteInput(
  event: H3Event,
  itemId: string,
) {
  return buildRouteInput(event, itemId)
}

export default defineEventHandler((event) => {
  const itemId = getRouterParam(event, 'id')

  if (!itemId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing inbox item id',
    })
  }

  const input = buildRouteInput(event, itemId)

  if (input.registry) {
    registerStarAgentTools(input.registry as AgentToolRegistry, {
      keyId: input.keyId,
      now: input.now,
      works: input.works,
      memories: input.memories.getMemoryByKey
        ? {
            getMemoryByKey: input.memories.getMemoryByKey,
            updateMemory: input.memories.updateMemory,
          }
        : undefined,
      memoryEvents: input.memoryEvents,
    })
  }

  return approveAgentInboxItem(input)
})
