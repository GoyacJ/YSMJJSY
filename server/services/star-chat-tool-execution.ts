import type { AgentToolRegistry } from './agent-runtime'
import type { AgentPolicy } from './agent-policy'
import type { AgentEventRecord, AgentTaskRecord, AgentTaskType } from '../db/sqlite'
import type { StarChatToolCall, StarChatTurnPlan } from './star-chat-planner'
import { createAgentLoop } from './agent-loop'
import { enqueueAgentTask } from './agent-task-queue'

export type NormalizedStarChatToolCall = {
  toolName: string
  input: Record<string, unknown>
  mode: StarChatToolCall['mode']
  evidence: string
  reason: string
  status: 'ready' | 'rejected'
  error?: string
}

const mediaToolNames = new Set([
  'star.generateImage',
  'star.generateMusic',
  'star.generateVideo',
])

function rejectCall(call: StarChatToolCall, error: string): NormalizedStarChatToolCall {
  return {
    toolName: call.toolName,
    input: call.input,
    mode: call.mode,
    evidence: call.evidence,
    reason: call.reason,
    status: 'rejected',
    error,
  }
}

function hasPrompt(input: Record<string, unknown>) {
  return typeof input.prompt === 'string' && Boolean(input.prompt.trim())
}

function normalizeInput(call: StarChatToolCall, reply: string) {
  if (call.toolName !== 'star.speakReply') {
    return call.input
  }

  return {
    ...call.input,
    text: call.input.text === '$reply' ? reply : call.input.text,
  }
}

export function normalizeStarChatToolCalls(input: {
  plan: StarChatTurnPlan
  registry: Pick<AgentToolRegistry, 'get'>
  reply: string
}): NormalizedStarChatToolCall[] {
  return input.plan.toolCalls.slice(0, 4).map((call) => {
    if (!input.registry.get(call.toolName)) {
      return rejectCall(call, 'Unknown tool')
    }

    const normalizedInput = normalizeInput(call, input.reply)

    if (mediaToolNames.has(call.toolName) && !hasPrompt(normalizedInput)) {
      return rejectCall({ ...call, input: normalizedInput }, 'Missing prompt')
    }

    return {
      toolName: call.toolName,
      input: normalizedInput,
      mode: call.mode,
      evidence: call.evidence,
      reason: call.reason,
      status: 'ready',
    }
  })
}

type TaskRepository = {
  addTask: (record: AgentTaskRecord) => void
  updateTask: (id: string, updates: Partial<Pick<AgentTaskRecord, 'status' | 'resultJson' | 'error' | 'updatedAt'>>) => void
}

type EventRepository = {
  addEvent: (record: AgentEventRecord) => void
}

export type StarChatToolExecutionResult = {
  toolName: string
  taskId?: string
  inboxItemId?: string
  status: 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'denied' | 'rejected'
  title?: string
  summary?: string
  error?: string
  result?: Record<string, unknown>
}

function taskTypeForTool(toolName: string): AgentTaskType {
  if (toolName === 'star.publishWork') {
    return 'publish_artifact'
  }

  if (toolName === 'star.governMemory') {
    return 'govern_memory'
  }

  if (toolName === 'star.previewDesign') {
    return 'preview_design'
  }

  if (toolName === 'star.commitDesign') {
    return 'commit_design'
  }

  if (toolName === 'star.generateImage' || toolName === 'star.generateMusic' || toolName === 'star.generateVideo' || toolName === 'star.speakReply') {
    return 'generate_artifact'
  }

  return 'reflect'
}

function summarizeCall(call: NormalizedStarChatToolCall) {
  return call.reason || call.evidence || `执行 ${call.toolName}。`
}

function findLatestStatus(
  taskId: string,
  updates: Array<{ id: string, updates: Partial<Pick<AgentTaskRecord, 'status' | 'resultJson' | 'error'>> }>,
) {
  return [...updates].reverse().find(update => update.id === taskId)?.updates
}

export async function executeStarChatToolCalls(input: {
  agentId: string
  now: string
  calls: NormalizedStarChatToolCall[]
  tasks: TaskRepository
  events: EventRepository
  registry: Pick<AgentToolRegistry, 'get' | 'execute'>
  policy: Partial<AgentPolicy>
}): Promise<StarChatToolExecutionResult[]> {
  const results: StarChatToolExecutionResult[] = []
  const updates: Array<{ id: string, updates: Partial<Pick<AgentTaskRecord, 'status' | 'resultJson' | 'error'>> }> = []
  const tasks: TaskRepository = {
    addTask: input.tasks.addTask,
    updateTask(id, update) {
      updates.push({ id, updates: update })
      input.tasks.updateTask(id, update)
    },
  }
  const loop = createAgentLoop({
    now: input.now,
    tasks,
    events: input.events,
    registry: input.registry,
    policy: input.policy,
  })

  for (const call of input.calls) {
    if (call.status === 'rejected') {
      results.push({
        toolName: call.toolName,
        status: 'rejected',
        error: call.error,
      })
      continue
    }

    const task = enqueueAgentTask({
      agentId: input.agentId,
      type: taskTypeForTool(call.toolName),
      title: call.toolName,
      summary: summarizeCall(call),
      input: {
        toolName: call.toolName,
        input: call.input,
      },
      now: input.now,
      tasks,
      events: input.events,
    })

    await loop.runTask(task)

    const update = findLatestStatus(task.id, updates)
    const status = update?.status === 'failed' && update.error
      ? 'denied'
      : update?.status ?? task.status

    results.push({
      toolName: call.toolName,
      taskId: task.id,
      status,
      ...(status === 'waiting_approval' ? { inboxItemId: `task_approval:${task.id}` } : {}),
      title: task.title,
      summary: task.summary,
      ...(update?.error ? { error: update.error } : {}),
      ...(update?.resultJson ? { result: JSON.parse(update.resultJson) as Record<string, unknown> } : {}),
    })
  }

  return results
}
