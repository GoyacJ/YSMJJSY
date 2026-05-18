import { defineEventHandler } from 'h3'
import {
  createAgentInstanceRepository,
  createAgentTaskRepository,
} from '../../../db/sqlite'
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

  return buildAgentTasksResponse({
    tasks: createAgentTaskRepository(config.sqlitePath),
    agentId: agent.id,
  })
})
