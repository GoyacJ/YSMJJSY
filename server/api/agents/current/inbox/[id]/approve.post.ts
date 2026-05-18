import { nanoid } from 'nanoid'
import { createError, defineEventHandler, getRouterParam, type H3Event } from 'h3'
import {
  createAgentEventRepository,
  createAgentEvolutionRepository,
  createAgentInstanceRepository,
  createAgentSnapshotRepository,
  createAgentStateRepository,
  createAgentWorkRepository,
  createKeyProfileRepository,
  createMemoryRepository,
  type AgentEventRecord,
  type AgentEvolutionProposalRecord,
  type AgentStateRecord,
  type AgentStateSnapshotRecord,
  type AgentWorkRecord,
  type AgentWorkVisibility,
} from '../../../../../db/sqlite'
import { applyAgentProposalAction } from '../../../../agent/proposals/[id].put'
import { updateAgentWorkVisibilityAction } from '../../../../agent/works/[id].put'
import { requireAgentKey } from '../../../../agent/core.get'

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
  }
  states: {
    updateAgentState: (keyId: string, updates: Partial<Omit<AgentStateRecord, 'keyId'>> & { updatedAt: string }) => void
  }
  memories: {
    updateMemory: (id: string, updates: { importance?: number, status?: 'active' | 'archived' | 'rejected', updatedAt: string }) => void
  }
  works: {
    getWorkByKey: (keyId: string, id: string) => AgentWorkRecord | undefined
    updateWorkVisibility: (keyId: string, id: string, visibility: AgentWorkVisibility, updatedAt: string) => void
  }
  events: {
    addEvent: (record: AgentEventRecord) => void
  }
}

type ParsedInboxItem = {
  type: 'proposal' | 'work_visibility'
  id: string
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

  if ((type === 'proposal' || type === 'work_visibility') && id) {
    return { type, id }
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Invalid inbox item id',
  })
}

export function addApprovalEvent(input: InboxActionInput, parsed: ParsedInboxItem, approved: boolean) {
  input.events.addEvent({
    id: `event_${nanoid()}`,
    agentId: input.agentId,
    type: approved ? 'approval.approved' : 'approval.rejected',
    title: approved ? '审批通过' : '审批拒绝',
    summary: approved ? '待办已通过。' : '待办已拒绝。',
    targetType: parsed.type === 'proposal' ? 'proposal' : 'work',
    targetId: parsed.id,
    payloadJson: JSON.stringify({ itemId: input.itemId }),
    visibility: 'private',
    createdAt: input.now,
  })
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

  updateAgentWorkVisibilityAction({
    keyId: input.keyId,
    workId: parsed.id,
    visibility: 'public',
    now: input.now,
    works: input.works,
  })
  addApprovalEvent(input, parsed, true)

  return {
    id: parsed.id,
    type: parsed.type,
    status: 'approved',
  }
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
    states,
    memories: createMemoryRepository(config.sqlitePath),
    works: createAgentWorkRepository(config.sqlitePath),
    events: createAgentEventRepository(config.sqlitePath),
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

  return approveAgentInboxItem(buildRouteInput(event, itemId))
})
