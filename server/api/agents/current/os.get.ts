import { defineEventHandler } from 'h3'
import {
  createAgentEventRepository,
  createAgentEvolutionRepository,
  createAgentInstanceRepository,
  createAgentObservationRepository,
  createAgentSleepRepository,
  createAgentSnapshotRepository,
  createAgentTaskRepository,
  createAgentWorkRepository,
} from '../../../db/sqlite'
import { createAgentLoop } from '../../../services/agent-loop'
import { buildAgentOsResponse } from '../../../services/agent-os'
import { requireAgentKey } from '../../agent/core.get'

export function buildCurrentAgentOsResponse(input: {
  keyId: string
  now: string
  agents: Pick<ReturnType<typeof createAgentInstanceRepository>, 'getOrCreateAgentForOwner'>
  tasks: Pick<ReturnType<typeof createAgentTaskRepository>, 'listTasksByAgent'>
  events: Pick<ReturnType<typeof createAgentEventRepository>, 'listEventsByAgent'>
  proposals: Pick<ReturnType<typeof createAgentEvolutionRepository>, 'listProposalsByKey'>
  works: Pick<ReturnType<typeof createAgentWorkRepository>, 'listWorksByKey'>
  sleeps?: Pick<ReturnType<typeof createAgentSleepRepository>, 'getLatestSleepRunByKey'>
  snapshots?: Pick<ReturnType<typeof createAgentSnapshotRepository>, 'listSnapshotsByKey'>
  observations?: Pick<ReturnType<typeof createAgentObservationRepository>, 'listObservationsByAgent'>
}) {
  const agent = input.agents.getOrCreateAgentForOwner({
    ownerType: 'key',
    ownerId: input.keyId,
    domain: 'star',
    now: input.now,
  })
  const tasks = input.tasks.listTasksByAgent(agent.id)
  const events = input.events.listEventsByAgent(agent.id)
  const plannedTasks = input.observations
    ? createAgentLoop({
        now: input.now,
        tasks: { updateTask: () => {} },
        events: { addEvent: () => {} },
        registry: { get: () => undefined, execute: async () => ({ ok: false }) },
        policy: {},
      }).planTasks({
        observations: input.observations.listObservationsByAgent(agent.id),
        existingTasks: tasks,
      })
    : undefined

  return buildAgentOsResponse({
    agent,
    tasks,
    events,
    pendingProposals: input.proposals.listProposalsByKey(input.keyId, 'pending'),
    publicWorkCandidates: input.works
      .listWorksByKey(input.keyId)
      .filter(work => work.visibility === 'private'),
    latestSleepRun: input.sleeps?.getLatestSleepRunByKey(input.keyId),
    rollbackCandidates: input.snapshots?.listSnapshotsByKey(input.keyId, 12),
    plannedTasks,
  })
}

export default defineEventHandler((event) => {
  const keyId = requireAgentKey(event)
  const config = useRuntimeConfig(event)

  return buildCurrentAgentOsResponse({
    keyId,
    now: new Date().toISOString(),
    agents: createAgentInstanceRepository(config.sqlitePath),
    tasks: createAgentTaskRepository(config.sqlitePath),
    events: createAgentEventRepository(config.sqlitePath),
    proposals: createAgentEvolutionRepository(config.sqlitePath),
    works: createAgentWorkRepository(config.sqlitePath),
    sleeps: createAgentSleepRepository(config.sqlitePath),
    snapshots: createAgentSnapshotRepository(config.sqlitePath),
    observations: createAgentObservationRepository(config.sqlitePath),
  })
})
