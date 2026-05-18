import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import {
  createAgentEventRepository,
  createAgentInstanceRepository,
  createAgentTaskRepository,
  createAgentWorkRepository,
  createMemoryEventRepository,
  createMemoryRepository,
  type AgentTaskRecord,
} from '../../../../db/sqlite'
import { cancelAgentTask } from '../../../../services/agent-task-queue'
import { createAgentLoop } from '../../../../services/agent-loop'
import { defaultAgentPolicy } from '../../../../services/agent-policy'
import { createAgentToolRegistry } from '../../../../services/agent-runtime'
import { registerDefaultStarAgentTools } from '../../../../services/star-agent-runtime'
import { requireAgentKey } from '../../../agent/core.get'
import { serializeAgentTaskForOs } from '../tasks.post'

function parseTaskUpdateBody(body: unknown): { action: 'cancel' | 'run' } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid task action' })
  }

  const action = (body as { action?: unknown }).action

  if (action === 'cancel' || action === 'run') {
    return { action }
  }

  throw createError({ statusCode: 400, statusMessage: 'Invalid task action' })
}

export async function updateCurrentAgentTask(input: {
  agentId: string
  taskId: string
  now: string
  body: unknown
  tasks: Pick<ReturnType<typeof createAgentTaskRepository>, 'getTask' | 'updateTask'>
  events: Pick<ReturnType<typeof createAgentEventRepository>, 'addEvent'>
  registry: Pick<ReturnType<typeof createAgentToolRegistry>, 'get' | 'execute'>
}) {
  const body = parseTaskUpdateBody(input.body)
  const task = input.tasks.getTask(input.taskId)

  if (!task || task.agentId !== input.agentId) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  if (body.action === 'cancel') {
    cancelAgentTask({
      task,
      now: input.now,
      tasks: input.tasks,
      events: input.events,
    })

    return {
      task: serializeAgentTaskForOs({
        ...task,
        status: 'cancelled',
        updatedAt: input.now,
      } as AgentTaskRecord),
    }
  }

  await createAgentLoop({
    now: input.now,
    tasks: input.tasks,
    events: input.events,
    registry: input.registry,
    policy: defaultAgentPolicy,
  }).runTask(task)

  return {
    task: serializeAgentTaskForOs({
      ...task,
      updatedAt: input.now,
    }),
  }
}

export default defineEventHandler(async (event) => {
  const keyId = requireAgentKey(event)
  const taskId = getRouterParam(event, 'id')

  if (!taskId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing task id' })
  }

  const config = useRuntimeConfig(event)
  const now = new Date().toISOString()
  const agent = createAgentInstanceRepository(config.sqlitePath).getOrCreateAgentForOwner({
    ownerType: 'key',
    ownerId: keyId,
    domain: 'star',
    now,
  })
  const registry = createAgentToolRegistry()

  registerDefaultStarAgentTools(registry, {
    keyId,
    now,
    minimaxApiKey: config.minimaxApiKey,
    minimaxGroupId: config.minimaxGroupId,
    works: createAgentWorkRepository(config.sqlitePath),
    memories: createMemoryRepository(config.sqlitePath),
    memoryEvents: createMemoryEventRepository(config.sqlitePath),
  })

  return updateCurrentAgentTask({
    agentId: agent.id,
    taskId,
    now,
    body: await readBody(event),
    tasks: createAgentTaskRepository(config.sqlitePath),
    events: createAgentEventRepository(config.sqlitePath),
    registry,
  })
})
