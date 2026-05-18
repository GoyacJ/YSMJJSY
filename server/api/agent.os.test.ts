import { describe, expect, it } from 'vitest'
import { buildCurrentAgentOsResponse } from './agents/current/os.get'

describe('agent os api helpers', () => {
  it('returns os state for the current key agent', () => {
    const result = buildCurrentAgentOsResponse({
      keyId: 'key_1',
      now: '2026-05-18T00:00:00.000Z',
      agents: {
        getOrCreateAgentForOwner: () => ({
          id: 'agent_1',
          status: 'active',
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
          bindingId: 'binding_1',
          ownerType: 'key',
          ownerId: 'key_1',
          domain: 'star',
        }),
      },
      tasks: { listTasksByAgent: () => [] },
      events: { listEventsByAgent: () => [] },
      proposals: { listProposalsByKey: () => [] },
      works: { listWorksByKey: () => [] },
    })

    expect(result.agent).toMatchObject({ id: 'agent_1', ownerId: 'key_1' })
  })
})
