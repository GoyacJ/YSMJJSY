import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import {
  createAgentEventRepository,
  createAgentInstanceRepository,
  createAgentTaskRepository,
  createAgentWorkRepository,
  createKeyProfileRepository,
  type AgentEventRecord,
  type AgentTaskRecord,
  type AgentWorkRecord,
  type AgentWorkVisibility,
} from '../../../db/sqlite'
import { createAgentLoop } from '../../../services/agent-loop'
import { createAgentPolicyFromBoundarySettings, defaultAgentPolicy, type AgentPolicy } from '../../../services/agent-policy'
import { enqueueAgentTask } from '../../../services/agent-task-queue'
import { createAgentToolRegistry, type AgentToolRegistry } from '../../../services/agent-runtime'
import { registerStarAgentTools } from '../../../services/star-agent-tools'
import { requireAgentKey } from '../core.get'

export function updateAgentWorkVisibilityAction(input: {
  keyId: string
  workId: string
  visibility: AgentWorkVisibility
  now: string
  works: {
    getWorkByKey: (keyId: string, id: string) => AgentWorkRecord | undefined
    updateWorkVisibility: (keyId: string, id: string, visibility: AgentWorkVisibility, updatedAt: string) => void
  }
}) {
  const work = input.works.getWorkByKey(input.keyId, input.workId)

  if (!work) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Work not found',
    })
  }

  input.works.updateWorkVisibility(input.keyId, input.workId, input.visibility, input.now)

  return {
    id: input.workId,
    visibility: input.visibility,
  }
}

export async function publishWorkWithTool(input: {
  toolName: 'star.publishWork'
  workId: string
  registry: Pick<AgentToolRegistry, 'execute'>
}) {
  const result = await input.registry.execute(input.toolName, { workId: input.workId })

  if (!result.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: result.error ?? 'Work publishing failed',
    })
  }

  return result.output as { id: string, visibility: AgentWorkVisibility }
}

export async function publishWorkActionOrTask(input: {
  keyId: string
  agentId: string
  workId: string
  visibility: AgentWorkVisibility
  now: string
  works: {
    getWorkByKey: (keyId: string, id: string) => AgentWorkRecord | undefined
    updateWorkVisibility: (keyId: string, id: string, visibility: AgentWorkVisibility, updatedAt: string) => void
  }
  tasks: {
    addTask: (record: AgentTaskRecord) => void
    updateTask: (id: string, updates: Partial<Pick<AgentTaskRecord, 'status' | 'resultJson' | 'error' | 'updatedAt'>>) => void
  }
  events: { addEvent: (record: AgentEventRecord) => void }
  registry: Pick<AgentToolRegistry, 'get' | 'execute'>
  policy?: AgentPolicy
}) {
  if (input.visibility !== 'public') {
    return updateAgentWorkVisibilityAction({
      keyId: input.keyId,
      workId: input.workId,
      visibility: input.visibility,
      now: input.now,
      works: input.works,
    })
  }

  const task = enqueueAgentTask({
    agentId: input.agentId,
    type: 'publish_artifact',
    title: '公开作品',
    summary: '公开一个作品。',
    input: {
      toolName: 'star.publishWork',
      input: { workId: input.workId },
    },
    now: input.now,
    tasks: input.tasks,
    events: input.events,
  })

  await createAgentLoop({
    now: input.now,
    tasks: input.tasks,
    events: input.events,
    registry: input.registry,
    policy: input.policy ?? defaultAgentPolicy,
  }).runTask(task)

  return {
    status: 'waiting_approval',
    taskId: task.id,
  }
}

function parseWorkVisibilityBody(body: unknown): AgentWorkVisibility {
  if (body && typeof body === 'object') {
    const visibility = (body as { visibility?: unknown }).visibility

    if (visibility === 'private' || visibility === 'public') {
      return visibility
    }
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Invalid work visibility',
  })
}

export default defineEventHandler(async (event) => {
  const keyId = requireAgentKey(event)
  const workId = getRouterParam(event, 'id')

  if (!workId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing work id',
    })
  }

  const config = useRuntimeConfig(event)
  const visibility = parseWorkVisibilityBody(await readBody(event))
  const now = new Date().toISOString()

  const works = createAgentWorkRepository(config.sqlitePath)

  if (visibility === 'public') {
    const agent = createAgentInstanceRepository(config.sqlitePath).getOrCreateAgentForOwner({
      ownerType: 'key',
      ownerId: keyId,
      domain: 'star',
      now,
    })
    const registry = createAgentToolRegistry()
    const profile = createKeyProfileRepository(config.sqlitePath).getKeyProfile(keyId)

    if (!profile) {
      throw createError({ statusCode: 404, statusMessage: 'Profile not found' })
    }

    registerStarAgentTools(registry, {
      keyId,
      now,
      boundarySettings: profile.boundarySettings,
      works,
    })

    return publishWorkActionOrTask({
      keyId,
      agentId: agent.id,
      workId,
      visibility,
      now,
      works,
      tasks: createAgentTaskRepository(config.sqlitePath),
      events: createAgentEventRepository(config.sqlitePath),
      registry,
      policy: createAgentPolicyFromBoundarySettings(profile.boundarySettings),
    })
  }

  return updateAgentWorkVisibilityAction({
    keyId,
    workId,
    visibility,
    now,
    works,
  })
})
