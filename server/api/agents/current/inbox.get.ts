import { defineEventHandler } from 'h3'
import {
  createAgentEvolutionRepository,
  createAgentInstanceRepository,
  createAgentSleepRepository,
  createAgentTaskRepository,
  createAgentWorkRepository,
  type AgentEvolutionProposalRecord,
  type AgentWorkRecord,
} from '../../../db/sqlite'
import { buildAgentInbox, parseMemoryActionCandidatesFromSleepRun } from '../../../services/agent-os'
import { requireAgentKey } from '../../agent/core.get'

export function buildAgentInboxResponse(input: {
  pendingProposals: AgentEvolutionProposalRecord[]
  publicWorkCandidates: AgentWorkRecord[]
  memoryActionCandidates?: ReturnType<typeof parseMemoryActionCandidatesFromSleepRun>
  waitingApprovalTasks?: Parameters<typeof buildAgentInbox>[0]['waitingApprovalTasks']
}) {
  return {
    inbox: buildAgentInbox(input),
  }
}

export default defineEventHandler((event) => {
  const keyId = requireAgentKey(event)
  const config = useRuntimeConfig(event)
  const now = new Date().toISOString()
  const agent = createAgentInstanceRepository(config.sqlitePath).getOrCreateAgentForOwner({
    ownerType: 'key',
    ownerId: keyId,
    domain: 'star',
    now,
  })
  const tasks = createAgentTaskRepository(config.sqlitePath).listTasksByAgent(agent.id)

  return buildAgentInboxResponse({
    pendingProposals: createAgentEvolutionRepository(config.sqlitePath).listProposalsByKey(keyId, 'pending'),
    publicWorkCandidates: createAgentWorkRepository(config.sqlitePath)
      .listWorksByKey(keyId)
      .filter(work => work.visibility === 'private'),
    memoryActionCandidates: parseMemoryActionCandidatesFromSleepRun(
      createAgentSleepRepository(config.sqlitePath).getLatestSleepRunByKey(keyId),
    ),
    waitingApprovalTasks: tasks.filter(task => task.status === 'waiting_approval'),
  })
})
