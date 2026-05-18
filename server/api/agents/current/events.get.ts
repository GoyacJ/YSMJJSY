import { defineEventHandler } from 'h3'
import {
  createAgentEventRepository,
  createAgentInstanceRepository,
} from '../../../db/sqlite'
import { serializeAgentEventForOs } from '../../../services/agent-events'
import { requireAgentKey } from '../../agent/core.get'

export function buildAgentEventsResponse(input: {
  events: Pick<ReturnType<typeof createAgentEventRepository>, 'listEventsByAgent'>
  agentId: string
}) {
  return {
    events: input.events.listEventsByAgent(input.agentId).map(serializeAgentEventForOs),
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

  return buildAgentEventsResponse({
    events: createAgentEventRepository(config.sqlitePath),
    agentId: agent.id,
  })
})
