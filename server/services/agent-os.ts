import type {
  AgentEventRecord,
  AgentEvolutionProposalRecord,
  AgentForOwnerRecord,
  AgentSleepRunRecord,
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

export function parseMemoryActionCandidatesFromSleepRun(run?: AgentSleepRunRecord | null): AgentMemoryActionCandidate[] {
  if (!run?.memoryActionsJson || run.status !== 'completed') {
    return []
  }

  try {
    const parsed = JSON.parse(run.memoryActionsJson) as unknown

    if (!Array.isArray(parsed)) {
      return []
    }

    const seen = new Set<string>()

    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return []
      }

      const record = item as { memoryId?: unknown, action?: unknown, reason?: unknown }

      if (typeof record.memoryId !== 'string' || typeof record.action !== 'string') {
        return []
      }

      const key = `${record.memoryId}:${record.action}`

      if (seen.has(key)) {
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

export function buildAgentOsResponse(input: {
  agent: AgentForOwnerRecord
  tasks: AgentTaskRecord[]
  events: AgentEventRecord[]
  pendingProposals: AgentEvolutionProposalRecord[]
  publicWorkCandidates: AgentWorkRecord[]
  latestSleepRun?: AgentSleepRunRecord | null
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
      memoryActionCandidates: parseMemoryActionCandidatesFromSleepRun(input.latestSleepRun),
      waitingApprovalTasks: input.tasks.filter(task => task.status === 'waiting_approval'),
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
  }
}
