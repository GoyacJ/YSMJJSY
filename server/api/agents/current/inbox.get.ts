import { defineEventHandler } from 'h3'
import {
  createAgentEventRepository,
  createAgentEvolutionRepository,
  createAgentInstanceRepository,
  createAgentSleepRepository,
  createAgentSnapshotRepository,
  createAgentTaskRepository,
  createAgentWorkRepository,
  type AgentEvolutionProposalRecord,
  type AgentStateSnapshotRecord,
  type AgentWorkRecord,
} from '../../../db/sqlite'
import { buildAgentInbox, parseMemoryActionCandidatesFromSleepRun } from '../../../services/agent-os'
import { requireAgentKey } from '../../agent/core.get'

export function buildAgentInboxResponse(input: {
  pendingProposals: AgentEvolutionProposalRecord[]
  publicWorkCandidates: AgentWorkRecord[]
  memoryActionCandidates?: ReturnType<typeof parseMemoryActionCandidatesFromSleepRun>
  waitingApprovalTasks?: Parameters<typeof buildAgentInbox>[0]['waitingApprovalTasks']
  rollbackCandidates?: Array<Pick<AgentStateSnapshotRecord, 'id' | 'proposalId' | 'createdAt'>>
}) {
  return {
    inbox: buildAgentInbox({
      ...input,
      rollbackCandidates: (input.rollbackCandidates ?? []).map(snapshot => ({
        snapshotId: snapshot.id,
        title: '回滚状态快照',
        summary: snapshot.proposalId
          ? `恢复提案 ${snapshot.proposalId} 之前的状态。`
          : '恢复历史状态快照。',
        createdAt: snapshot.createdAt,
      })),
    }),
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
      createAgentEventRepository(config.sqlitePath).listEventsByAgent(agent.id),
    ),
    waitingApprovalTasks: tasks.filter(task => task.status === 'waiting_approval'),
    rollbackCandidates: createAgentSnapshotRepository(config.sqlitePath).listSnapshotsByKey(keyId, 12),
  })
})
