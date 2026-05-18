import type {
  AgentEventRecord,
  AgentEvolutionProposalRecord,
  AgentForOwnerRecord,
  AgentTaskRecord,
  AgentWorkRecord,
} from '../db/sqlite'
import { serializeAgentEventForOs } from './agent-events'

export type AgentOsInboxItem = {
  id: string
  type: 'proposal' | 'work_visibility'
  title: string
  summary: string
  action: 'approve' | 'publish'
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
      ? parsed as Record<string, unknown>
      : undefined
  } catch {
    return undefined
  }
}

export function buildAgentInbox(input: {
  pendingProposals: AgentEvolutionProposalRecord[]
  publicWorkCandidates: AgentWorkRecord[]
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
  ]
}

export function buildAgentOsResponse(input: {
  agent: AgentForOwnerRecord
  tasks: AgentTaskRecord[]
  events: AgentEventRecord[]
  pendingProposals: AgentEvolutionProposalRecord[]
  publicWorkCandidates: AgentWorkRecord[]
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
