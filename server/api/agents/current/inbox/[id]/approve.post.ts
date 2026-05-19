import { nanoid } from 'nanoid'
import { createError, defineEventHandler, getRouterParam, type H3Event } from 'h3'
import {
  createAgentEventRepository,
  createAgentEvolutionRepository,
  createAgentInstanceRepository,
  createAgentObservationRepository,
  createAgentReflectionRepository,
  createAgentSleepRepository,
  createAgentTaskRepository,
  createConversationRepository,
  createKeyDesignRepository,
  createMemoryEventRepository,
  createAgentSnapshotRepository,
  createAgentStateRepository,
  createAgentWorkRepository,
  createKeyProfileRepository,
  createMemoryRepository,
  createMediaTaskRepository,
  type AgentEventRecord,
  type AgentEvolutionProposalRecord,
  type AgentObservationRecord,
  type AgentStateRecord,
  type AgentStateSnapshotRecord,
  type AgentTaskRecord,
  type AgentTaskType,
  type AgentWorkRecord,
  type AgentWorkVisibility,
  type KeyDesignRecord,
  type MemoryEventRecord,
  type MemoryRecord,
  type StarBoundarySettings,
} from '../../../../../db/sqlite'
import { applyAgentProposalAction } from '../../../../agent/proposals/[id].put'
import { restoreAgentSnapshotAction } from '../../../../agent/snapshots/[id]/restore.post'
import { requireAgentKey } from '../../../../agent/core.get'
import { buildAgentEvent } from '../../../../../services/agent-events'
import { createAgentPolicyFromBoundarySettings, defaultAgentPolicy, type AgentPolicy } from '../../../../../services/agent-policy'
import { cancelAgentTask, enqueueAgentTask } from '../../../../../services/agent-task-queue'
import { createAgentLoop } from '../../../../../services/agent-loop'
import { createAgentToolRegistry, type AgentToolRegistry } from '../../../../../services/agent-runtime'
import { createDefaultAgentProviderRegistry } from '../../../../../services/agent-providers'
import { runManualAgentSleep } from '../../../../../services/agent-sleep'
import { commitKeyDesign } from '../../../../../services/design-commit'
import { parseDesignSchema } from '../../../../../services/design-schema'
import { markKeyActivity } from '../../../../../services/key-activity'
import { registerDefaultStarAgentTools } from '../../../../../services/star-agent-runtime'

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
    getSnapshotByKey?: (keyId: string, id: string) => AgentStateSnapshotRecord | undefined
  }
  designs?: {
    getLatestDesign: (keyId: string) => Pick<KeyDesignRecord, 'version'> | undefined
    addKeyDesign: (record: { keyId: string, version: number, schemaJson: string, prompt: string, createdAt: string }) => void
  }
  states: {
    updateAgentState: (keyId: string, updates: Partial<Omit<AgentStateRecord, 'keyId'>> & { updatedAt: string }) => void
  }
  memories: {
    getMemoryByKey?: (keyId: string, id: string) => MemoryRecord | undefined
    updateMemory: (id: string, updates: { importance?: number, status?: 'active' | 'pending' | 'archived' | 'rejected', updatedAt: string }) => void
    deleteMemoryByKey?: (keyId: string, id: string) => number
  }
  memoryEvents?: {
    addMemoryEvent: (record: MemoryEventRecord) => void
  }
  tasks?: {
    addTask?: (record: AgentTaskRecord) => void
    getTask: (id: string) => AgentTaskRecord | undefined
    updateTask: (id: string, updates: Partial<Pick<AgentTaskRecord, 'status' | 'resultJson' | 'error' | 'updatedAt'>>) => void
  }
  registry?: Pick<AgentToolRegistry, 'get' | 'execute'>
  policy?: AgentPolicy
  boundarySettings?: StarBoundarySettings
  works: {
    getWorkByKey: (keyId: string, id: string) => AgentWorkRecord | undefined
    updateWorkVisibility: (keyId: string, id: string, visibility: AgentWorkVisibility, updatedAt: string) => void
  }
  events: {
    addEvent: (record: AgentEventRecord) => void
  }
  observations?: {
    addObservation: (record: AgentObservationRecord) => void
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
  const observationId = `observation_${nanoid()}`

  input.observations?.addObservation({
    id: observationId,
    agentId: input.agentId,
    sourceType: 'approval',
    sourceId: input.itemId,
    summary: approved ? '用户批准了 Agent OS 待办。' : '用户拒绝了 Agent OS 待办。',
    payloadJson: JSON.stringify({ itemId: input.itemId, approved }),
    createdAt: input.now,
  })
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
    payload: { itemId: input.itemId, observationId },
    createdAt: input.now,
  }))
}

async function runApprovedInboxTask(input: InboxActionInput, taskInput: {
  type: AgentTaskType
  title: string
  summary: string
  toolName: string
  toolInput: Record<string, unknown>
}) {
  if (!input.tasks?.addTask || !input.registry) {
    throw createError({ statusCode: 400, statusMessage: 'Task approval action unavailable' })
  }

  const task = enqueueAgentTask({
    agentId: input.agentId,
    type: taskInput.type,
    title: taskInput.title,
    summary: taskInput.summary,
    input: {
      toolName: taskInput.toolName,
      input: taskInput.toolInput,
    },
    now: input.now,
    tasks: { addTask: input.tasks.addTask },
    events: input.events,
  })

  await createAgentLoop({
    now: input.now,
    tasks: input.tasks,
    events: input.events,
    registry: input.registry,
    policy: input.policy ?? defaultAgentPolicy,
  }).runTask(task, { approvalGranted: true })

  return task
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
      boundarySettings: input.boundarySettings,
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
    return runApprovedInboxTask(input, {
      type: 'publish_artifact',
      title: '公开作品',
      summary: '公开一个作品。',
      toolName: 'star.publishWork',
      toolInput: { workId: parsed.id },
    }).then(() => {
      addApprovalEvent(input, parsed, true)

      return {
        id: parsed.id,
        type: parsed.type,
        status: 'approved',
      }
    })
  }

  if (parsed.type === 'memory_governance') {
    if (!parsed.action) {
      throw createError({ statusCode: 400, statusMessage: 'Memory governance action unavailable' })
    }

    return runApprovedInboxTask(input, {
      type: 'govern_memory',
      title: '治理记忆',
      summary: '执行记忆治理。',
      toolName: 'star.governMemory',
      toolInput: {
        memoryId: parsed.id,
        action: parsed.action,
        reason: 'Agent OS inbox approval',
      },
    }).then(() => {
      addApprovalEvent(input, parsed, true)

      return {
        id: parsed.id,
        type: parsed.type,
        status: parsed.action === 'reject' ? 'rejected' : parsed.action,
      }
    })
  }

  if (parsed.type === 'task_approval') {
    if (!input.tasks || !input.registry) {
      throw createError({ statusCode: 400, statusMessage: 'Task approval action unavailable' })
    }

    const task = input.tasks.getTask(parsed.id)

    if (!task || task.agentId !== input.agentId) {
      throw createError({ statusCode: 404, statusMessage: 'Task not found' })
    }

    return createAgentLoop({
      now: input.now,
      tasks: input.tasks,
      events: input.events,
      registry: input.registry,
      policy: input.policy ?? defaultAgentPolicy,
    }).runTask(task, { approvalGranted: true }).then(() => {
      addApprovalEvent(input, parsed, true)

      return {
        id: parsed.id,
        type: parsed.type,
        status: 'approved',
      }
    })
  }

  if (parsed.type === 'rollback') {
    if (!input.snapshots.getSnapshotByKey) {
      throw createError({ statusCode: 400, statusMessage: 'Rollback action unavailable' })
    }

    const result = restoreAgentSnapshotAction({
      keyId: input.keyId,
      snapshotId: parsed.id,
      snapshots: {
        getSnapshotByKey: input.snapshots.getSnapshotByKey,
      },
      states: input.states,
      designs: input.designs,
      now: input.now,
    })

    if (!result.restored) {
      throw createError({ statusCode: 404, statusMessage: 'Snapshot not restorable' })
    }

    addApprovalEvent(input, parsed, true)

    return {
      id: parsed.id,
      type: parsed.type,
      status: 'restored',
    }
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
    designs: createKeyDesignRepository(config.sqlitePath),
    states,
    memories: createMemoryRepository(config.sqlitePath),
    memoryEvents: createMemoryEventRepository(config.sqlitePath),
    works: createAgentWorkRepository(config.sqlitePath),
    tasks: createAgentTaskRepository(config.sqlitePath),
    events: createAgentEventRepository(config.sqlitePath),
    observations: createAgentObservationRepository(config.sqlitePath),
    registry: createAgentToolRegistry(),
    policy: createAgentPolicyFromBoundarySettings(profile.boundarySettings),
    boundarySettings: profile.boundarySettings,
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
    const config = useRuntimeConfig(event)
    const providerRegistry = createDefaultAgentProviderRegistry({
      minimaxApiKey: config.minimaxApiKey,
      minimaxGroupId: config.minimaxGroupId,
    })

    registerDefaultStarAgentTools(input.registry as AgentToolRegistry, {
      keyId: input.keyId,
      now: input.now,
      minimaxApiKey: config.minimaxApiKey,
      minimaxGroupId: config.minimaxGroupId,
      works: input.works,
      mediaTasks: createMediaTaskRepository(config.sqlitePath),
      memories: input.memories.getMemoryByKey && input.memories.deleteMemoryByKey
        ? {
            getMemoryByKey: input.memories.getMemoryByKey,
            updateMemory: input.memories.updateMemory,
            deleteMemoryByKey: input.memories.deleteMemoryByKey,
          }
        : undefined,
      memoryEvents: input.memoryEvents,
      boundarySettings: input.boundarySettings,
      sleep: () => runManualAgentSleep({
        keyId: input.keyId,
        now: input.now,
        client: providerRegistry.getDefault(),
        profile: input.profile,
        agentState: input.agentState,
        memories: createMemoryRepository(config.sqlitePath),
        conversations: createConversationRepository(config.sqlitePath),
        reflections: createAgentReflectionRepository(config.sqlitePath),
        proposals: createAgentEvolutionRepository(config.sqlitePath),
        sleeps: createAgentSleepRepository(config.sqlitePath),
        states: input.states,
      }),
      commitDesign: (toolInput) => {
        const record = toolInput && typeof toolInput === 'object' && !Array.isArray(toolInput)
          ? toolInput as { schema?: unknown, prompt?: unknown }
          : {}
        const schema = parseDesignSchema(record.schema)

        return commitKeyDesign({
          keyId: input.keyId,
          schema,
          prompt: typeof record.prompt === 'string' ? record.prompt : '',
          now: input.now,
          designs: createKeyDesignRepository(config.sqlitePath),
          works: createAgentWorkRepository(config.sqlitePath),
          markActivity: (keyId, kind) => markKeyActivity(config.sqlitePath, keyId, kind),
          observation: {
            agentId: input.agentId,
            observations: createAgentObservationRepository(config.sqlitePath),
            events: createAgentEventRepository(config.sqlitePath),
          },
        })
      },
    })
  }

  return approveAgentInboxItem(input)
})
