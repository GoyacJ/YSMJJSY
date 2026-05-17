import { describe, expect, it, vi } from 'vitest'
import { buildAgentCoreResponse, requireAgentKey } from './agent/core.get'
import { applyAgentProposalAction } from './agent/proposals/[id].put'

describe('agent core api helpers', () => {
  it('rejects unauthenticated requests', () => {
    expect(() => requireAgentKey({ context: {} } as any)).toThrow()
  })

  it('builds core response with profile, memory counts, reflections, and pending proposals', () => {
    expect(buildAgentCoreResponse({
      profile: {
        id: 'key_1',
        keyLookupHash: 'lookup',
        assistantName: '阿月',
        mbti: 'INTJ',
        configuredAt: '2026-05-17T00:00:00.000Z',
        createdIpHash: 'ip',
        createdAt: '2026-05-17T00:00:00.000Z',
        updatedAt: '2026-05-17T00:00:00.000Z',
      },
      memories: [
        {
          id: 'm1',
          keyId: 'key_1',
          type: 'preference',
          content: '用户喜欢短句。',
          importance: 0.8,
          confidence: 0.9,
          status: 'active',
          createdAt: '2026-05-17T00:00:00.000Z',
        },
        {
          id: 'm2',
          keyId: 'key_1',
          type: 'event',
          content: '旧事件。',
          importance: 0.5,
          confidence: 0.8,
          status: 'archived',
          createdAt: '2026-05-17T00:00:00.000Z',
        },
      ],
      reflections: [
        {
          id: 'r1',
          keyId: 'key_1',
          conversationId: 'c1',
          summary: '用户喜欢短句。',
          rawJson: '{}',
          createdAt: '2026-05-17T00:00:00.000Z',
        },
      ],
      proposals: [
        {
          id: 'p1',
          keyId: 'key_1',
          reflectionId: 'r1',
          type: 'tone',
          title: '更短',
          summary: '回复更短。',
          payloadJson: '{}',
          status: 'pending',
          createdAt: '2026-05-17T00:00:00.000Z',
          updatedAt: '2026-05-17T00:00:00.000Z',
        },
        {
          id: 'p2',
          keyId: 'key_1',
          reflectionId: 'r1',
          type: 'tone',
          title: '已拒绝',
          summary: '不显示。',
          payloadJson: '{}',
          status: 'rejected',
          createdAt: '2026-05-17T00:00:00.000Z',
          updatedAt: '2026-05-17T00:00:00.000Z',
        },
      ],
    })).toEqual({
      profile: {
        keyId: 'key_1',
        assistantName: '阿月',
        mbti: 'INTJ',
        configured: true,
      },
      memoryCounts: {
        total: 2,
        active: 1,
        archived: 1,
        rejected: 0,
      },
      latestReflections: [
        {
          id: 'r1',
          summary: '用户喜欢短句。',
          createdAt: '2026-05-17T00:00:00.000Z',
        },
      ],
      pendingProposals: [
        {
          id: 'p1',
          type: 'tone',
          title: '更短',
          summary: '回复更短。',
          payload: {},
          createdAt: '2026-05-17T00:00:00.000Z',
        },
      ],
    })
  })

  it('accepts a proposal and writes a snapshot', () => {
    const updateProposal = vi.fn()
    const addSnapshot = vi.fn()

    const result = applyAgentProposalAction({
      keyId: 'key_1',
      proposalId: 'p1',
      action: 'accept',
      now: '2026-05-17T00:10:00.000Z',
      profile: { assistantName: '阿月', mbti: 'INTJ' },
      proposals: {
        listProposalsByKey: () => [{
          id: 'p1',
          keyId: 'key_1',
          reflectionId: 'r1',
          type: 'tone',
          title: '更短',
          summary: '回复更短。',
          payloadJson: '{"tone":"concise"}',
          status: 'pending',
          createdAt: '2026-05-17T00:00:00.000Z',
          updatedAt: '2026-05-17T00:00:00.000Z',
        }],
        updateProposal,
      },
      snapshots: { addSnapshot },
    })

    expect(result?.status).toBe('accepted')
    expect(updateProposal).toHaveBeenCalledWith('p1', {
      status: 'accepted',
      updatedAt: '2026-05-17T00:10:00.000Z',
    })
    expect(addSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      keyId: 'key_1',
      proposalId: 'p1',
      profileJson: JSON.stringify({
        assistantName: '阿月',
        mbti: 'INTJ',
        acceptedProposal: {
          type: 'tone',
          payload: { tone: 'concise' },
        },
      }),
    }))
  })

  it('rejects a proposal without writing a snapshot', () => {
    const updateProposal = vi.fn()
    const addSnapshot = vi.fn()

    const result = applyAgentProposalAction({
      keyId: 'key_1',
      proposalId: 'p1',
      action: 'reject',
      now: '2026-05-17T00:10:00.000Z',
      profile: { assistantName: '阿月', mbti: 'INTJ' },
      proposals: {
        listProposalsByKey: () => [{
          id: 'p1',
          keyId: 'key_1',
          reflectionId: 'r1',
          type: 'tone',
          title: '更短',
          summary: '回复更短。',
          payloadJson: '{}',
          status: 'pending',
          createdAt: '2026-05-17T00:00:00.000Z',
          updatedAt: '2026-05-17T00:00:00.000Z',
        }],
        updateProposal,
      },
      snapshots: { addSnapshot },
    })

    expect(result?.status).toBe('rejected')
    expect(updateProposal).toHaveBeenCalledWith('p1', {
      status: 'rejected',
      updatedAt: '2026-05-17T00:10:00.000Z',
    })
    expect(addSnapshot).not.toHaveBeenCalled()
  })

  it('does not mutate another key proposal', () => {
    const updateProposal = vi.fn()

    expect(applyAgentProposalAction({
      keyId: 'key_2',
      proposalId: 'p1',
      action: 'accept',
      now: '2026-05-17T00:10:00.000Z',
      profile: { assistantName: '阿月', mbti: 'INTJ' },
      proposals: {
        listProposalsByKey: () => [],
        updateProposal,
      },
      snapshots: { addSnapshot: vi.fn() },
    })).toBeUndefined()
    expect(updateProposal).not.toHaveBeenCalled()
  })
})
