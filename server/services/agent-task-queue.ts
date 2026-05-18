import { nanoid } from 'nanoid'
import type { AgentEventRecord, AgentTaskRecord, AgentTaskType } from '../db/sqlite'
import type { AgentPolicy } from './agent-policy'
import { defaultAgentPolicy, evaluateAgentToolPolicy } from './agent-policy'
import { buildAgentEvent } from './agent-events'
import type { AgentToolRegistry, AgentToolResult } from './agent-runtime'

type TaskRepository = {
  addTask?: (record: AgentTaskRecord) => void
  updateTask: (id: string, updates: Partial<Pick<AgentTaskRecord, 'status' | 'resultJson' | 'error' | 'updatedAt'>>) => void
}

type EventRepository = {
  addEvent: (record: AgentEventRecord) => void
}

export function parseTaskInputJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  }
  catch {
    // handled below
  }

  return {}
}

export function enqueueAgentTask(input: {
  agentId: string
  type: AgentTaskType
  title: string
  summary: string
  input: Record<string, unknown>
  now: string
  tasks: Required<Pick<TaskRepository, 'addTask'>>
  events: EventRepository
}) {
  const task: AgentTaskRecord = {
    id: `task_${nanoid()}`,
    agentId: input.agentId,
    type: input.type,
    status: 'queued',
    title: input.title,
    summary: input.summary,
    inputJson: JSON.stringify(input.input),
    resultJson: null,
    error: null,
    createdAt: input.now,
    updatedAt: input.now,
  }

  input.tasks.addTask(task)
  input.events.addEvent(buildAgentEvent({
    id: `event_${nanoid()}`,
    agentId: input.agentId,
    type: 'task.queued',
    title: '任务入队',
    summary: input.summary,
    targetType: 'task',
    targetId: task.id,
    payload: { taskType: input.type },
    createdAt: input.now,
  }))

  return task
}

export function startAgentTask(input: {
  task: AgentTaskRecord
  now: string
  tasks: Pick<TaskRepository, 'updateTask'>
  events: EventRepository
}) {
  input.tasks.updateTask(input.task.id, {
    status: 'running',
    error: null,
    updatedAt: input.now,
  })
  input.events.addEvent(buildAgentEvent({
    id: `event_${nanoid()}`,
    agentId: input.task.agentId,
    type: 'task.started',
    title: '任务开始',
    summary: input.task.summary,
    targetType: 'task',
    targetId: input.task.id,
    createdAt: input.now,
  }))
}

export function completeAgentTask(input: {
  task: AgentTaskRecord
  result: unknown
  summary?: string
  now: string
  tasks: Pick<TaskRepository, 'updateTask'>
  events: EventRepository
}) {
  input.tasks.updateTask(input.task.id, {
    status: 'completed',
    resultJson: JSON.stringify(input.result ?? {}),
    error: null,
    updatedAt: input.now,
  })
  input.events.addEvent(buildAgentEvent({
    id: `event_${nanoid()}`,
    agentId: input.task.agentId,
    type: 'task.completed',
    title: '任务完成',
    summary: input.summary ?? input.task.summary,
    targetType: 'task',
    targetId: input.task.id,
    payload: { result: input.result },
    createdAt: input.now,
  }))
}

export function failAgentTask(input: {
  task: AgentTaskRecord
  error: string
  now: string
  tasks: Pick<TaskRepository, 'updateTask'>
  events: EventRepository
}) {
  input.tasks.updateTask(input.task.id, {
    status: 'failed',
    error: input.error,
    updatedAt: input.now,
  })
  input.events.addEvent(buildAgentEvent({
    id: `event_${nanoid()}`,
    agentId: input.task.agentId,
    type: 'task.failed',
    title: '任务失败',
    summary: input.error,
    targetType: 'task',
    targetId: input.task.id,
    createdAt: input.now,
  }))
}

export function cancelAgentTask(input: {
  task: AgentTaskRecord
  now: string
  tasks: Pick<TaskRepository, 'updateTask'>
  events: EventRepository
}) {
  input.tasks.updateTask(input.task.id, {
    status: 'cancelled',
    updatedAt: input.now,
  })
  input.events.addEvent(buildAgentEvent({
    id: `event_${nanoid()}`,
    agentId: input.task.agentId,
    type: 'task.cancelled',
    title: '任务取消',
    summary: input.task.summary,
    targetType: 'task',
    targetId: input.task.id,
    createdAt: input.now,
  }))
}

function mergePolicy(policy: Partial<AgentPolicy>): AgentPolicy {
  return {
    ...defaultAgentPolicy,
    ...policy,
  }
}

export async function runAgentTask(input: {
  task: AgentTaskRecord
  now: string
  tasks: Pick<TaskRepository, 'updateTask'>
  events: EventRepository
  registry: Pick<AgentToolRegistry, 'get' | 'execute'>
  policy: Partial<AgentPolicy>
  approvalGranted?: boolean
}) {
  const taskInput = parseTaskInputJson(input.task.inputJson)
  const toolName = typeof taskInput.toolName === 'string' ? taskInput.toolName : undefined
  const toolInput = taskInput.input ?? {}

  if (!toolName) {
    failAgentTask({
      task: input.task,
      error: 'Task input is missing toolName',
      now: input.now,
      tasks: input.tasks,
      events: input.events,
    })
    return
  }

  const tool = input.registry.get(toolName)

  if (!tool) {
    failAgentTask({
      task: input.task,
      error: `Agent tool not found: ${toolName}`,
      now: input.now,
      tasks: input.tasks,
      events: input.events,
    })
    return
  }

  const decision = evaluateAgentToolPolicy(mergePolicy(input.policy), tool)

  if (!decision.allowed) {
    input.tasks.updateTask(input.task.id, {
      status: 'failed',
      error: decision.reason ?? 'Policy denied',
      updatedAt: input.now,
    })
    input.events.addEvent(buildAgentEvent({
      id: `event_${nanoid()}`,
      agentId: input.task.agentId,
      type: 'policy.denied',
      title: '策略拒绝',
      summary: decision.reason ?? '策略拒绝执行该任务。',
      targetType: 'task',
      targetId: input.task.id,
      payload: { toolName },
      createdAt: input.now,
    }))
    return
  }

  if (decision.approvalRequired && !input.approvalGranted) {
    input.tasks.updateTask(input.task.id, {
      status: 'waiting_approval',
      updatedAt: input.now,
    })
    input.events.addEvent(buildAgentEvent({
      id: `event_${nanoid()}`,
      agentId: input.task.agentId,
      type: 'approval.required',
      title: '需要审批',
      summary: input.task.summary,
      targetType: 'task',
      targetId: input.task.id,
      payload: { toolName },
      createdAt: input.now,
    }))
    return
  }

  startAgentTask({
    task: input.task,
    now: input.now,
    tasks: input.tasks,
    events: input.events,
  })

  const result: AgentToolResult = await input.registry.execute(toolName, toolInput)

  if (!result.ok) {
    failAgentTask({
      task: input.task,
      error: result.error ?? 'Agent tool failed',
      now: input.now,
      tasks: input.tasks,
      events: input.events,
    })
    return
  }

  completeAgentTask({
    task: input.task,
    result: result.output ?? {},
    now: input.now,
    tasks: input.tasks,
    events: input.events,
  })
}
