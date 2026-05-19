import type {
  AgentEventRecord,
  AgentEvolutionProposalRecord,
  AgentForOwnerRecord,
  AgentSleepRunRecord,
  AgentStateSnapshotRecord,
  AgentTaskRecord,
  AgentWorkRecord,
} from '../db/sqlite'
import { serializeAgentEventForOs } from './agent-events'
import { sanitizeAgentResponseValue } from './agent-privacy'

export type AgentOsInboxItem = {
  id: string
  type: 'proposal' | 'work_visibility' | 'memory_governance' | 'task_approval' | 'rollback'
  title: string
  summary: string
  action: 'approve' | 'publish' | 'execute' | 'rollback'
  createdAt: string
}

export type AgentMemoryActionCandidate = {
  memoryId: string
  action: string
  reason: string
  createdAt: string
}

export type AgentOsResponse = {
  agent: {
    id: string
    status: string
    ownerType: string
    ownerId: string
    domain: string
  }
  inbox: AgentOsInboxItem[]
  tasks: Array<{
    id: string
    type: string
    status: string
    title: string
    summary: string
    result?: Record<string, unknown>
    error?: string | null
    createdAt: string
    updatedAt: string
  }>
  events: Array<{
    id: string
    type: string
    title: string
    summary: string
    targetType?: string | null
    targetId?: string | null
    createdAt: string
  }>
  records: AgentOsRecordItem[]
  plannedTasks?: Array<{
    type: string
    title: string
    summary: string
    input?: Record<string, unknown>
  }>
}

export type AgentOsRecordItem = {
  id: string
  type: '记忆' | '行动' | '作品' | '发布' | '整理' | '失败'
  title: string
  summary: string
  status: string
  createdAt: string
  details?: {
    sections: Array<{
      title: string
      items: string[]
    }>
  }
}

export function parseJsonObject(value?: string | null): Record<string, unknown> | undefined {
  if (!value) {
    return undefined
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? sanitizeAgentResponseValue(parsed) as Record<string, unknown>
      : undefined
  } catch {
    return undefined
  }
}

export function buildAgentInbox(input: {
  pendingProposals: AgentEvolutionProposalRecord[]
  publicWorkCandidates: AgentWorkRecord[]
  memoryActionCandidates?: AgentMemoryActionCandidate[]
  waitingApprovalTasks?: Pick<AgentTaskRecord, 'id' | 'type' | 'status' | 'title' | 'summary' | 'createdAt'>[]
  rollbackCandidates?: Array<{ snapshotId: string, title: string, summary: string, createdAt: string }>
}): AgentOsInboxItem[] {
  return [
    ...input.pendingProposals.map(proposal => ({
      id: `proposal:${proposal.id}`,
      type: 'proposal' as const,
      title: proposal.title,
      summary: proposal.summary,
      action: 'approve' as const,
      createdAt: proposal.createdAt,
    })),
    ...input.publicWorkCandidates.map(work => ({
      id: `work_visibility:${work.id}`,
      type: 'work_visibility' as const,
      title: work.title,
      summary: work.summary,
      action: 'publish' as const,
      createdAt: work.createdAt,
    })),
    ...(input.memoryActionCandidates ?? []).map(item => ({
      id: `memory_governance:${item.memoryId}:${item.action}`,
      type: 'memory_governance' as const,
      title: '记忆治理',
      summary: item.reason,
      action: 'execute' as const,
      createdAt: item.createdAt,
    })),
    ...(input.waitingApprovalTasks ?? []).map(task => ({
      id: `task_approval:${task.id}`,
      type: 'task_approval' as const,
      title: task.title,
      summary: task.summary,
      action: 'approve' as const,
      createdAt: task.createdAt,
    })),
    ...(input.rollbackCandidates ?? []).map(item => ({
      id: `rollback:${item.snapshotId}`,
      type: 'rollback' as const,
      title: item.title,
      summary: item.summary,
      action: 'rollback' as const,
      createdAt: item.createdAt,
    })),
  ]
}

function parseHandledInboxItemIds(events: AgentEventRecord[], since?: string | null) {
  const handled = new Set<string>()

  for (const event of events) {
    if (event.type !== 'approval.approved' && event.type !== 'approval.rejected') {
      continue
    }

    if (since && event.createdAt < since) {
      continue
    }

    try {
      const payload = JSON.parse(event.payloadJson) as { itemId?: unknown }

      if (typeof payload.itemId === 'string') {
        handled.add(payload.itemId)
      }
    }
    catch {
      // Ignore malformed private event payloads.
    }
  }

  return handled
}

export function parseMemoryActionCandidatesFromSleepRun(
  run?: AgentSleepRunRecord | null,
  events: AgentEventRecord[] = [],
): AgentMemoryActionCandidate[] {
  if (!run?.memoryActionsJson || run.status !== 'completed') {
    return []
  }

  try {
    const parsed = JSON.parse(run.memoryActionsJson) as unknown

    if (!Array.isArray(parsed)) {
      return []
    }

    const seen = new Set<string>()
    const handled = parseHandledInboxItemIds(events, run.completedAt ?? run.startedAt)

    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return []
      }

      const record = item as { memoryId?: unknown, action?: unknown, reason?: unknown }

      if (typeof record.memoryId !== 'string' || typeof record.action !== 'string') {
        return []
      }

      const key = `${record.memoryId}:${record.action}`
      const itemId = `memory_governance:${record.memoryId}:${record.action}`

      if (seen.has(key) || handled.has(itemId)) {
        return []
      }

      seen.add(key)

      return [{
        memoryId: record.memoryId,
        action: record.action,
        reason: typeof record.reason === 'string' ? record.reason : '需要确认记忆治理动作。',
        createdAt: run.completedAt ?? run.startedAt,
      }]
    })
  }
  catch {
    return []
  }
}

function getRecordType(event: AgentEventRecord): AgentOsRecordItem['type'] {
  if (event.type === 'task.failed' || event.type === 'tool.failed' || event.type === 'provider.failed' || event.type === 'policy.denied') {
    return '失败'
  }

  if (event.type === 'organizing_report.completed' || event.targetType === 'sleep') {
    return '整理'
  }

  if (event.targetType === 'memory') {
    return '记忆'
  }

  if (event.targetType === 'work' && (event.type === 'approval.approved' || event.type === 'approval.required')) {
    return '发布'
  }

  if (event.targetType === 'work') {
    return '作品'
  }

  return '行动'
}

function getRecordStatus(event: AgentEventRecord) {
  if (event.type === 'task.completed' || event.type === 'tool.completed' || event.type === 'organizing_report.completed') {
    return '完成'
  }

  if (event.type === 'task.failed' || event.type === 'tool.failed' || event.type === 'provider.failed' || event.type === 'policy.denied') {
    return '失败'
  }

  if (event.type === 'task.started' || event.type === 'tool.started') {
    return '进行中'
  }

  if (event.type === 'task.queued') {
    return '等待'
  }

  if (event.type === 'task.cancelled') {
    return '已取消'
  }

  if (event.type === 'approval.required') {
    return '待确认'
  }

  if (event.type === 'approval.approved') {
    return '已确认'
  }

  if (event.type === 'approval.rejected') {
    return '已拒绝'
  }

  return '已记录'
}

function getRecordTitle(event: AgentEventRecord, type: AgentOsRecordItem['type']) {
  if (event.type === 'provider.failed') {
    return '模型调用失败'
  }

  if (event.type === 'tool.failed') {
    return '行动执行失败'
  }

  if (event.type === 'policy.denied') {
    return '行动被边界拦截'
  }

  if (event.type === 'task.failed') {
    return event.title || '行动失败'
  }

  if (type === '发布' && event.type === 'approval.required') {
    return event.title || '公开待确认'
  }

  return event.title || type
}

function parseOrganizingReportDetails(event: AgentEventRecord): AgentOsRecordItem['details'] | undefined {
  if (event.type !== 'organizing_report.completed') {
    return undefined
  }

  const payload = parseJsonObject(event.payloadJson)
  const sections = Array.isArray(payload?.sections) ? payload.sections : []
  const normalized = sections.flatMap((section) => {
    if (!section || typeof section !== 'object' || Array.isArray(section)) {
      return []
    }

    const record = section as { title?: unknown, items?: unknown }
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    const items = Array.isArray(record.items)
      ? record.items
          .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
          .map(item => item.trim())
      : []

    if (!title || items.length === 0) {
      return []
    }

    return [{ title, items }]
  })

  return normalized.length > 0 ? { sections: normalized } : undefined
}

export function buildAgentRecords(events: AgentEventRecord[]): AgentOsRecordItem[] {
  return events.map((event) => {
    const type = getRecordType(event)
    const details = parseOrganizingReportDetails(event)

    return {
      id: event.id,
      type,
      title: getRecordTitle(event, type),
      summary: event.summary,
      status: getRecordStatus(event),
      createdAt: event.createdAt,
      ...(details ? { details } : {}),
    }
  })
}

export function buildAgentOsResponse(input: {
  agent: AgentForOwnerRecord
  tasks: AgentTaskRecord[]
  events: AgentEventRecord[]
  pendingProposals: AgentEvolutionProposalRecord[]
  publicWorkCandidates: AgentWorkRecord[]
  latestSleepRun?: AgentSleepRunRecord | null
  rollbackCandidates?: Array<Pick<AgentStateSnapshotRecord, 'id' | 'proposalId' | 'createdAt'> | {
    snapshotId: string
    title: string
    summary: string
    createdAt: string
  }>
  plannedTasks?: Array<{
    type: string
    title: string
    summary: string
    input?: Record<string, unknown>
  }>
}): AgentOsResponse {
  return {
    agent: {
      id: input.agent.id,
      status: input.agent.status,
      ownerType: input.agent.ownerType,
      ownerId: input.agent.ownerId,
      domain: input.agent.domain,
    },
    inbox: buildAgentInbox({
      pendingProposals: input.pendingProposals,
      publicWorkCandidates: input.publicWorkCandidates,
      memoryActionCandidates: parseMemoryActionCandidatesFromSleepRun(input.latestSleepRun, input.events),
      waitingApprovalTasks: input.tasks.filter(task => task.status === 'waiting_approval'),
      rollbackCandidates: (input.rollbackCandidates ?? []).map((snapshot) => {
        if ('snapshotId' in snapshot) {
          return snapshot
        }

        return {
          snapshotId: snapshot.id,
          title: '回滚状态快照',
          summary: snapshot.proposalId
            ? `恢复提案 ${snapshot.proposalId} 之前的状态。`
            : '恢复历史状态快照。',
          createdAt: snapshot.createdAt,
        }
      }),
    }),
    tasks: input.tasks.map(task => ({
      id: task.id,
      type: task.type,
      status: task.status,
      title: task.title,
      summary: task.summary,
      result: parseJsonObject(task.resultJson),
      error: task.error ?? null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    })),
    events: input.events.map(serializeAgentEventForOs),
    records: buildAgentRecords(input.events),
    plannedTasks: input.plannedTasks?.map(task => ({
      type: task.type,
      title: task.title,
      summary: task.summary,
      input: task.input ? sanitizeAgentResponseValue(task.input) as Record<string, unknown> : undefined,
    })),
  }
}
