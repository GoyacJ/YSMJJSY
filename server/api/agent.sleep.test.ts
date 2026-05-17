import { describe, expect, it, vi } from 'vitest'
import { runManualAgentSleep } from './agent/sleep.post'

describe('agent sleep api helpers', () => {
  it('runs a manual sleep cycle and creates proposals', async () => {
    const addSleepRun = vi.fn()
    const updateSleepRun = vi.fn()
    const addReflection = vi.fn()
    const addProposal = vi.fn()
    const updateAgentState = vi.fn()

    const result = await runManualAgentSleep({
      keyId: 'key_1',
      now: '2026-05-17T00:00:00.000Z',
      client: {
        reflectAgent: vi.fn(async () => JSON.stringify({
          dailySummary: '整理完成。',
          memoryActions: [],
          proposals: [{ type: 'tone', title: '更短', summary: '更短。', payload: { tone: '更短' } }],
          workIdeas: [],
          nextConversationHints: [],
        })),
      },
      profile: { assistantName: '月光', mbti: 'INTJ' },
      agentState: {
        keyId: 'key_1',
        tone: '克制、温柔、安静',
        relationshipRole: '记忆星球守护者',
        learningMode: 'assisted',
        contentStrategy: {},
        updatedAt: '2026-05-17T00:00:00.000Z',
      },
      memories: {
        listMemoriesByKey: () => [],
      },
      conversations: {
        listRecentConversationsByKey: () => [],
      },
      reflections: {
        listReflectionsByKey: () => [],
        addReflection,
      },
      proposals: {
        addProposal,
      },
      sleeps: {
        addSleepRun,
        updateSleepRun,
      },
      states: {
        updateAgentState,
      },
    })

    expect(result.run.status).toBe('completed')
    expect(result.proposals).toHaveLength(1)
    expect(addSleepRun).toHaveBeenCalledWith(expect.objectContaining({ status: 'running' }))
    expect(updateSleepRun).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status: 'completed' }))
    expect(addReflection).toHaveBeenCalledWith(expect.objectContaining({ summary: '整理完成。' }))
    expect(addProposal).toHaveBeenCalledWith(expect.objectContaining({ title: '更短' }))
    expect(updateAgentState).toHaveBeenCalledWith('key_1', {
      lastSleepAt: '2026-05-17T00:00:00.000Z',
      updatedAt: '2026-05-17T00:00:00.000Z',
    })
  })
})
