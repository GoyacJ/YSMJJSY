import { defineEventHandler } from 'h3'
import {
  createAgentEvolutionRepository,
  createAgentWorkRepository,
  type AgentEvolutionProposalRecord,
  type AgentWorkRecord,
} from '../../../db/sqlite'
import { buildAgentInbox } from '../../../services/agent-os'
import { requireAgentKey } from '../../agent/core.get'

export function buildAgentInboxResponse(input: {
  pendingProposals: AgentEvolutionProposalRecord[]
  publicWorkCandidates: AgentWorkRecord[]
}) {
  return {
    inbox: buildAgentInbox(input),
  }
}

export default defineEventHandler((event) => {
  const keyId = requireAgentKey(event)
  const config = useRuntimeConfig(event)

  return buildAgentInboxResponse({
    pendingProposals: createAgentEvolutionRepository(config.sqlitePath).listProposalsByKey(keyId, 'pending'),
    publicWorkCandidates: createAgentWorkRepository(config.sqlitePath)
      .listWorksByKey(keyId)
      .filter(work => work.visibility === 'private'),
  })
})
