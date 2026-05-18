import { defineEventHandler } from 'h3'
import {
  createAgentEventRepository,
  createAgentInstanceRepository,
  createAgentTaskRepository,
} from '../../../db/sqlite'
import { recoverStaleRunningTasks } from '../../../services/agent-task-recovery'
import { requireAgentKey } from '../../agent/core.get'
import { buildAgentTasksResponse } from './tasks.post'

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
  const tasks = createAgentTaskRepository(config.sqlitePath)

  recoverStaleRunningTasks({
    now,
    staleAfterMs: 30 * 60 * 1000,
    tasks: tasks.listTasksByStatus('running').filter(task => task.agentId === agent.id),
    taskRepo: tasks,
    events: createAgentEventRepository(config.sqlitePath),
  })

  return buildAgentTasksResponse({
    tasks,
    agentId: agent.id,
  })
})
