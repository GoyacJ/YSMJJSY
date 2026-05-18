import { defineEventHandler } from 'h3'
import {
  createAgentInstanceRepository,
  type AgentForOwnerRecord,
} from '../../db/sqlite'
import { requireAgentKey } from '../agent/core.get'

export function serializeCurrentAgent(agent: AgentForOwnerRecord) {
  return {
    id: agent.id,
    status: agent.status,
    ownerType: agent.ownerType,
    ownerId: agent.ownerId,
    domain: agent.domain,
  }
}

export function buildCurrentAgentResponse(input: {
  keyId: string
  now: string
  agents: Pick<ReturnType<typeof createAgentInstanceRepository>, 'getOrCreateAgentForOwner'>
}) {
  const agent = input.agents.getOrCreateAgentForOwner({
    ownerType: 'key',
    ownerId: input.keyId,
    domain: 'star',
    now: input.now,
  })

  return {
    agent: serializeCurrentAgent(agent),
  }
}

export default defineEventHandler((event) => {
  const keyId = requireAgentKey(event)
  const config = useRuntimeConfig(event)

  return buildCurrentAgentResponse({
    keyId,
    now: new Date().toISOString(),
    agents: createAgentInstanceRepository(config.sqlitePath),
  })
})
