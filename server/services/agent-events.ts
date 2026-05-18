import type { AgentEventRecord } from '../db/sqlite'
import type { AgentEventType } from './agent-domain'

export type BuildAgentEventInput = {
  id: string
  agentId: string
  type: AgentEventType
  title: string
  summary: string
  targetType?: string | null
  targetId?: string | null
  payload?: Record<string, unknown>
  visibility?: AgentEventRecord['visibility']
  createdAt: string
}

export type SerializedAgentEvent = {
  id: string
  type: string
  title: string
  summary: string
  targetType?: string | null
  targetId?: string | null
  createdAt: string
}

export function buildAgentEvent(input: BuildAgentEventInput): AgentEventRecord {
  return {
    id: input.id,
    agentId: input.agentId,
    type: input.type,
    title: input.title,
    summary: input.summary,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    payloadJson: JSON.stringify(input.payload ?? {}),
    visibility: input.visibility ?? 'private',
    createdAt: input.createdAt,
  }
}

export function serializeAgentEventForOs(event: AgentEventRecord): SerializedAgentEvent {
  return {
    id: event.id,
    type: event.type,
    title: event.title,
    summary: event.summary,
    targetType: event.targetType ?? null,
    targetId: event.targetId ?? null,
    createdAt: event.createdAt,
  }
}
