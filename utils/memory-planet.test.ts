import { describe, expect, it } from 'vitest'
import { buildMemoryPlanetState } from './memory-planet'
import type { AgentCore } from '../composables/useAgentCore'

const core: AgentCore = {
  profile: {
    keyId: 'key_1',
    assistantName: '阿月',
    mbti: 'INTJ',
    configured: true,
    tone: '克制、温柔、安静',
    relationshipRole: '记忆星球守护者',
    learningMode: '辅助学习',
  },
  memoryCounts: {
    total: 2,
    active: 2,
    archived: 0,
    rejected: 0,
  },
  memories: [
    {
      id: 'm1',
      type: 'preference',
      content: '用户喜欢短句。',
      importance: 0.9,
      confidence: 0.92,
      status: 'active',
      sourceConversationId: 'c1',
      governanceEvents: [
        {
          id: 'event_1',
          action: 'confirm',
          reason: '用户明确表达。',
          createdAt: '2026-05-17T00:07:00.000Z',
        },
      ],
      createdAt: '2026-05-17T00:00:00.000Z',
    },
    {
      id: 'm2',
      type: 'event',
      content: '用户提到一首歌。',
      importance: 0.55,
      confidence: 0.8,
      createdAt: '2026-05-17T00:01:00.000Z',
    },
  ],
  latestReflections: [
    {
      id: 'r1',
      summary: '用户偏好克制表达。',
      createdAt: '2026-05-17T00:02:00.000Z',
    },
  ],
  proposals: {
    pending: [
      {
        id: 'p1',
        type: 'tone',
        title: '更安静',
        summary: '回复更安静。',
        payload: { tone: '安静' },
        status: 'pending',
        createdAt: '2026-05-17T00:03:00.000Z',
        updatedAt: '2026-05-17T00:03:00.000Z',
      },
    ],
    history: [
      {
        id: 'p2',
        type: 'relationship_role',
        title: '守护者',
        summary: '成为守护者。',
        payload: { relationshipRole: '守护者' },
        status: 'accepted',
        createdAt: '2026-05-17T00:04:00.000Z',
        updatedAt: '2026-05-17T00:04:00.000Z',
      },
      {
        id: 'p3',
        type: 'content_strategy',
        title: '已应用',
        summary: '减少解释。',
        payload: { strategy: 'brief' },
        status: 'applied',
        createdAt: '2026-05-17T00:05:00.000Z',
        updatedAt: '2026-05-17T00:05:00.000Z',
      },
      {
        id: 'p4',
        type: 'tone',
        title: '已拒绝',
        summary: '不要这样。',
        payload: {},
        status: 'rejected',
        createdAt: '2026-05-17T00:06:00.000Z',
        updatedAt: '2026-05-17T00:06:00.000Z',
      },
    ],
  },
}

describe('buildMemoryPlanetState', () => {
  it('turns active memories into deterministic memory stars', () => {
    const state = buildMemoryPlanetState(core)

    expect(state.memoryStars).toHaveLength(2)
    expect(state.memoryStars[0]).toMatchObject({
      id: 'm1',
      label: '用户喜欢短句。',
      type: 'preference',
      status: 'active',
      sourceConversationId: 'c1',
      latestGovernanceEvent: {
        id: 'event_1',
        action: 'confirm',
        reason: '用户明确表达。',
        createdAt: '2026-05-17T00:07:00.000Z',
      },
      bright: true,
    })
    expect(state.memoryStars[1]).toMatchObject({
      id: 'm2',
      bright: false,
    })
    expect(buildMemoryPlanetState(core).memoryStars[0].position).toEqual(state.memoryStars[0].position)
  })

  it('turns reflections into nebulas and pending proposals into lights', () => {
    const state = buildMemoryPlanetState(core)

    expect(state.reflectionNebulas).toEqual([
      expect.objectContaining({
        id: 'r1',
        summary: '用户偏好克制表达。',
      }),
    ])
    expect(state.proposalLights).toEqual([
      expect.objectContaining({
        id: 'p1',
        title: '更安静',
        status: 'pending',
      }),
    ])
  })

  it('keeps visual nodes inside the safe stage area', () => {
    const manyMemoriesCore: AgentCore = {
      ...core,
      memories: Array.from({ length: 18 }, (_, index) => ({
        id: `memory_${index}`,
        type: 'preference',
        content: `记忆 ${index}`,
        importance: 0.7,
        confidence: 0.8,
        createdAt: '2026-05-17T00:00:00.000Z',
      })),
      latestReflections: Array.from({ length: 6 }, (_, index) => ({
        id: `reflection_${index}`,
        summary: `反思 ${index}`,
        createdAt: '2026-05-17T00:00:00.000Z',
      })),
    }
    const state = buildMemoryPlanetState(manyMemoriesCore)
    const positions = [
      ...state.memoryStars.map(star => star.position),
      ...state.reflectionNebulas.map(nebula => nebula.position),
      ...state.proposalLights.map(light => light.position),
    ]

    expect(positions.length).toBeGreaterThan(0)
    expect(positions.every(position => (
      position.x >= 14
      && position.x <= 86
      && position.y >= 14
      && position.y <= 86
    ))).toBe(true)
  })

  it('turns accepted and applied proposals into orbit rings but excludes rejected proposals', () => {
    const state = buildMemoryPlanetState(core)

    expect(state.orbitRings.map(ring => ring.id)).toEqual(['p2', 'p3'])
    expect(state.proposalLights.map(light => light.id)).not.toContain('p4')
    expect(state.orbitRings.map(ring => ring.id)).not.toContain('p4')
  })

  it('returns an empty valid state without core input', () => {
    expect(buildMemoryPlanetState(null)).toEqual({
      memoryStars: [],
      reflectionNebulas: [],
      proposalLights: [],
      orbitRings: [],
    })
  })
})
