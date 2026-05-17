import { nanoid } from 'nanoid'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import {
  createAgentEvolutionRepository,
  createAgentSnapshotRepository,
  createAgentStateRepository,
  createKeyProfileRepository,
  createMemoryRepository,
  type AgentEvolutionProposalRecord,
  type AgentStateRecord,
  type AgentStateSnapshotRecord,
} from '../../../db/sqlite'
import { requireAgentKey } from '../core.get'

type ProposalAction = 'accept' | 'reject'

type ApplyAgentProposalActionInput = {
  keyId: string
  proposalId: string
  action: ProposalAction
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
}

function parsePayload(payloadJson: string) {
  try {
    const parsed = JSON.parse(payloadJson)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  }
  catch {
    return {}
  }
}

export function applyAgentProposalAction(input: ApplyAgentProposalActionInput) {
  const proposal = input.proposals
    .listProposalsByKey(input.keyId)
    .find(item => item.id === input.proposalId)

  if (!proposal) {
    return undefined
  }

  if (input.action === 'reject') {
    input.proposals.updateProposal(proposal.id, {
      status: 'rejected',
      updatedAt: input.now,
    })

    return {
      id: proposal.id,
      status: 'rejected',
    }
  }

  const payload = parsePayload(proposal.payloadJson)

  if (proposal.type === 'page_design') {
    return {
      id: proposal.id,
      status: 'pending',
      requiresPreview: true,
    }
  }

  input.snapshots.addSnapshot({
    id: nanoid(),
    keyId: input.keyId,
    proposalId: proposal.id,
    profileJson: JSON.stringify({
      profile: {
        assistantName: input.profile.assistantName,
        mbti: input.profile.mbti,
      },
      agentState: input.agentState,
      acceptedProposal: {
        type: proposal.type,
        payload,
      },
    }),
    createdAt: input.now,
  })

  if (proposal.type === 'tone' && typeof payload.tone === 'string') {
    input.states.updateAgentState(input.keyId, {
      tone: payload.tone,
      updatedAt: input.now,
    })
  }
  else if (proposal.type === 'relationship_role' && typeof payload.relationshipRole === 'string') {
    input.states.updateAgentState(input.keyId, {
      relationshipRole: payload.relationshipRole,
      updatedAt: input.now,
    })
  }
  else if (proposal.type === 'content_strategy') {
    input.states.updateAgentState(input.keyId, {
      contentStrategy: {
        ...input.agentState.contentStrategy,
        ...(typeof payload.replyLength === 'string' ? { replyLength: payload.replyLength as AgentStateRecord['contentStrategy']['replyLength'] } : {}),
        ...(typeof payload.structure === 'string' ? { structure: payload.structure as AgentStateRecord['contentStrategy']['structure'] } : {}),
        ...(typeof payload.initiative === 'string' ? { initiative: payload.initiative as AgentStateRecord['contentStrategy']['initiative'] } : {}),
      },
      updatedAt: input.now,
    })
  }
  else if (proposal.type === 'memory_weight') {
    const memoryId = typeof payload.memoryId === 'string'
      ? payload.memoryId
      : typeof payload.targetMemoryId === 'string'
        ? payload.targetMemoryId
        : ''
    const importance = typeof payload.importance === 'number' ? payload.importance : undefined

    if (memoryId && importance !== undefined) {
      input.memories.updateMemory(memoryId, {
        importance,
        updatedAt: input.now,
      })
    }
  }
  input.proposals.updateProposal(proposal.id, {
    status: 'applied',
    updatedAt: input.now,
  })

  return {
    id: proposal.id,
    status: 'applied',
  }
}

function parseProposalAction(input: unknown): ProposalAction {
  if (input && typeof input === 'object') {
    const action = (input as { action?: unknown }).action

    if (action === 'accept' || action === 'reject') {
      return action
    }
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Invalid proposal action',
  })
}

export default defineEventHandler(async (event) => {
  const keyId = requireAgentKey(event)
  const proposalId = getRouterParam(event, 'id')

  if (!proposalId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing proposal id',
    })
  }

  const action = parseProposalAction(await readBody(event))
  const config = useRuntimeConfig(event)
  const profile = createKeyProfileRepository(config.sqlitePath).getKeyProfile(keyId)

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Profile not found',
    })
  }

  const result = applyAgentProposalAction({
    keyId,
    proposalId,
    action,
    now: new Date().toISOString(),
    profile: {
      assistantName: profile.assistantName,
      mbti: profile.mbti,
    },
    agentState: createAgentStateRepository(config.sqlitePath).getOrCreateAgentState(keyId, new Date().toISOString()),
    proposals: createAgentEvolutionRepository(config.sqlitePath),
    snapshots: createAgentSnapshotRepository(config.sqlitePath),
    states: createAgentStateRepository(config.sqlitePath),
    memories: createMemoryRepository(config.sqlitePath),
  })

  if (!result) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Proposal not found',
    })
  }

  return result
})
