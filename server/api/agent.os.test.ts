import { describe, expect, it, vi } from 'vitest'
import { approveAgentInboxItem } from './agents/current/inbox/[id]/approve.post'
import { rejectAgentInboxItem } from './agents/current/inbox/[id]/reject.post'
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

  it('approves proposal inbox items through proposal actions and writes an event', () => {
    const updateProposal = vi.fn()
    const addEvent = vi.fn()

    expect(approveAgentInboxItem({
      itemId: 'proposal:proposal_1',
      keyId: 'key_1',
      agentId: 'agent_1',
      now: '2026-05-18T00:00:00.000Z',
      profile: { assistantName: '月光', mbti: 'INTJ' },
      agentState: {
        tone: '克制、温柔、安静',
        relationshipRole: '记忆星球守护者',
        learningMode: 'assisted',
        contentStrategy: {},
      },
      proposals: {
        listProposalsByKey: () => [{
          id: 'proposal_1',
          keyId: 'key_1',
          type: 'tone',
          title: '更短',
          summary: '回复更短。',
          payloadJson: JSON.stringify({ tone: '更短' }),
          status: 'pending',
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
        }],
        updateProposal,
      },
      snapshots: { addSnapshot: vi.fn() },
      states: { updateAgentState: vi.fn() },
      memories: { updateMemory: vi.fn() },
      works: {
        getWorkByKey: vi.fn(),
        updateWorkVisibility: vi.fn(),
      },
      events: { addEvent },
    })).toEqual({ id: 'proposal_1', type: 'proposal', status: 'applied' })

    expect(updateProposal).toHaveBeenCalledWith('proposal_1', {
      status: 'applied',
      updatedAt: '2026-05-18T00:00:00.000Z',
    })
    expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'approval.approved',
      targetType: 'proposal',
      targetId: 'proposal_1',
    }))
  })

  it('rejects proposal inbox items through proposal actions and writes an event', () => {
    const updateProposal = vi.fn()
    const addEvent = vi.fn()

    expect(rejectAgentInboxItem({
      itemId: 'proposal:proposal_1',
      keyId: 'key_1',
      agentId: 'agent_1',
      now: '2026-05-18T00:00:00.000Z',
      profile: { assistantName: '月光', mbti: 'INTJ' },
      agentState: {
        tone: '克制、温柔、安静',
        relationshipRole: '记忆星球守护者',
        learningMode: 'assisted',
        contentStrategy: {},
      },
      proposals: {
        listProposalsByKey: () => [{
          id: 'proposal_1',
          keyId: 'key_1',
          type: 'tone',
          title: '更短',
          summary: '回复更短。',
          payloadJson: '{}',
          status: 'pending',
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
        }],
        updateProposal,
      },
      snapshots: { addSnapshot: vi.fn() },
      states: { updateAgentState: vi.fn() },
      memories: { updateMemory: vi.fn() },
      works: {
        getWorkByKey: vi.fn(),
        updateWorkVisibility: vi.fn(),
      },
      events: { addEvent },
    })).toEqual({ id: 'proposal_1', type: 'proposal', status: 'rejected' })

    expect(updateProposal).toHaveBeenCalledWith('proposal_1', {
      status: 'rejected',
      updatedAt: '2026-05-18T00:00:00.000Z',
    })
    expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'approval.rejected',
      targetType: 'proposal',
      targetId: 'proposal_1',
    }))
  })

  it('approves work visibility inbox items and writes an event', () => {
    const updateWorkVisibility = vi.fn()
    const addEvent = vi.fn()
    const works = {
      getWorkByKey: () => ({
        id: 'work_1',
        keyId: 'key_1',
        type: 'image',
        title: '月光图',
        summary: '一张图。',
        payloadJson: '{}',
        visibility: 'private',
        createdAt: '2026-05-18T00:00:00.000Z',
        updatedAt: '2026-05-18T00:00:00.000Z',
      }),
      updateWorkVisibility,
    }

    expect(approveAgentInboxItem({
      itemId: 'work_visibility:work_1',
      keyId: 'key_1',
      agentId: 'agent_1',
      now: '2026-05-18T00:00:00.000Z',
      profile: { assistantName: '月光', mbti: 'INTJ' },
      agentState: {
        tone: '克制、温柔、安静',
        relationshipRole: '记忆星球守护者',
        learningMode: 'assisted',
        contentStrategy: {},
      },
      proposals: {
        listProposalsByKey: () => [],
        updateProposal: vi.fn(),
      },
      snapshots: { addSnapshot: vi.fn() },
      states: { updateAgentState: vi.fn() },
      memories: { updateMemory: vi.fn() },
      works,
      events: { addEvent },
    })).toEqual({ id: 'work_1', type: 'work_visibility', status: 'approved' })

    expect(updateWorkVisibility).toHaveBeenCalledWith('key_1', 'work_1', 'public', '2026-05-18T00:00:00.000Z')
    expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'approval.approved',
      targetType: 'work',
      targetId: 'work_1',
    }))
  })
})
