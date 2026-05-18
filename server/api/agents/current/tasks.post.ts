import { createError, defineEventHandler, readBody } from 'h3'
import {
  createAgentEventRepository,
  createAgentInstanceRepository,
  createAgentTaskRepository,
  type AgentTaskRecord,
  type AgentTaskType,
} from '../../../db/sqlite'
import { enqueueAgentTask } from '../../../services/agent-task-queue'
import { sanitizeAgentResponseValue } from '../../../services/agent-privacy'
import { requireAgentKey } from '../../agent/core.get'

const taskLabels: Record<AgentTaskType, { title: string, summary: string }> = {
  reflect: { title: '反思', summary: '整理最近上下文。' },
  sleep: { title: '睡眠整理', summary: '整理最近记忆。' },
  govern_memory: { title: '治理记忆', summary: '执行记忆治理。' },
  propose_evolution: { title: '生成进化提案', summary: '生成智能体进化提案。' },
  generate_artifact: { title: '生成作品', summary: '生成星球作品。' },
  preview_design: { title: '预览设计', summary: '生成页面设计预览。' },
  publish_artifact: { title: '公开作品', summary: '公开一个作品。' },
}

const supportedTaskTypes = new Set<AgentTaskType>([
  'sleep',
  'generate_artifact',
  'preview_design',
  'publish_artifact',
  'govern_memory',
])

function parseTaskCreateBody(body: unknown): { type: AgentTaskType, input: Record<string, unknown> } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid task body' })
  }

  const value = body as { type?: unknown, input?: unknown }

  if (typeof value.type !== 'string' || !supportedTaskTypes.has(value.type as AgentTaskType)) {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported task type' })
  }

  return {
    type: value.type as AgentTaskType,
    input: value.input && typeof value.input === 'object' && !Array.isArray(value.input)
      ? value.input as Record<string, unknown>
      : {},
  }
}

export function serializeAgentTaskForOs(task: AgentTaskRecord) {
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    title: task.title,
    summary: task.summary,
    result: task.resultJson ? sanitizeAgentResponseValue(JSON.parse(task.resultJson) as unknown) : undefined,
    error: task.error ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }
}

export function buildAgentTasksResponse(input: {
  tasks: Pick<ReturnType<typeof createAgentTaskRepository>, 'listTasksByAgent'>
  agentId: string
}) {
  return {
    tasks: input.tasks.listTasksByAgent(input.agentId).map(serializeAgentTaskForOs),
  }
}

export function enqueueCurrentAgentTask(input: {
  agentId: string
  now: string
  body: unknown
  tasks: Pick<ReturnType<typeof createAgentTaskRepository>, 'addTask'>
  events: Pick<ReturnType<typeof createAgentEventRepository>, 'addEvent'>
}) {
  const body = parseTaskCreateBody(input.body)
  const labels = taskLabels[body.type]
  const task = enqueueAgentTask({
    agentId: input.agentId,
    type: body.type,
    title: labels.title,
    summary: labels.summary,
    input: body.input,
    now: input.now,
    tasks: input.tasks,
    events: input.events,
  })

  return {
    task: serializeAgentTaskForOs(task),
  }
}

export default defineEventHandler(async (event) => {
  const keyId = requireAgentKey(event)
  const config = useRuntimeConfig(event)
  const now = new Date().toISOString()
  const agent = createAgentInstanceRepository(config.sqlitePath).getOrCreateAgentForOwner({
    ownerType: 'key',
    ownerId: keyId,
    domain: 'star',
    now,
  })

  return enqueueCurrentAgentTask({
    agentId: agent.id,
    now,
    body: await readBody(event),
    tasks: createAgentTaskRepository(config.sqlitePath),
    events: createAgentEventRepository(config.sqlitePath),
  })
})
