import { nanoid } from 'nanoid'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import {
  createAgentEvolutionRepository,
  createAgentSnapshotRepository,
  createKeyProfileRepository,
  type AgentEvolutionProposalRecord,
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
  proposals: {
    listProposalsByKey: (keyId: string) => AgentEvolutionProposalRecord[]
    updateProposal: (id: string, updates: Pick<AgentEvolutionProposalRecord, 'status' | 'updatedAt'>) => void
  }
  snapshots: {
    addSnapshot: (record: AgentStateSnapshotRecord) => void
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

  const status = input.action === 'accept' ? 'accepted' : 'rejected'

  input.proposals.updateProposal(proposal.id, {
    status,
    updatedAt: input.now,
  })

  if (input.action === 'accept') {
    input.snapshots.addSnapshot({
      id: nanoid(),
      keyId: input.keyId,
      proposalId: proposal.id,
      profileJson: JSON.stringify({
        assistantName: input.profile.assistantName,
        mbti: input.profile.mbti,
        acceptedProposal: {
          type: proposal.type,
          payload: parsePayload(proposal.payloadJson),
        },
      }),
      createdAt: input.now,
    })
  }

  return {
    id: proposal.id,
    status,
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
    proposals: createAgentEvolutionRepository(config.sqlitePath),
    snapshots: createAgentSnapshotRepository(config.sqlitePath),
  })

  if (!result) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Proposal not found',
    })
  }

  return result
})
