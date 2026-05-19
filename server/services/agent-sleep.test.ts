import { describe, expect, it, vi } from 'vitest'
import { runManualAgentSleep } from './agent-sleep'

function createSleepInput(overrides: Partial<Parameters<typeof runManualAgentSleep>[0]> = {}) {
  return {
    keyId: 'key_1',
    now: '2026-05-19T00:00:00.000Z',
    agent: { id: 'agent_1' },
    client: {
      reflectAgent: vi.fn(async () => JSON.stringify({
        dailySummary: '整理完成。',
        memoryActions: [
          { memoryId: 'memory_1', action: 'confirm', reason: '用户明确表达。' },
          { memoryId: 'memory_2', action: 'archive', reason: '不再适用。' },
        ],
        proposals: [
          { type: 'tone', title: '更短', summary: '回复更短。', payload: { tone: '短' } },
        ],
        workIdeas: [
          { type: 'letter', title: '短句回信', summary: '生成一封短信。' },
        ],
        nextConversationHints: ['下次继续确认偏好。'],
      })),
    },
    profile: { assistantName: '星信', mbti: 'INTJ' },
    agentState: { tone: '克制', relationshipRole: '守护者' },
    memories: {
      listMemoriesByKey: vi.fn(() => [
        {
          id: 'memory_1',
          keyId: 'key_1',
          type: 'preference',
          content: '用户喜欢短句。',
          importance: 0.8,
          confidence: 0.9,
          status: 'active',
          createdAt: '2026-05-18T00:00:00.000Z',
        },
        {
          id: 'memory_rejected',
          keyId: 'key_1',
          type: 'preference',
          content: '用户喜欢长句。',
          importance: 0.8,
          confidence: 0.9,
          status: 'rejected',
          createdAt: '2026-05-18T00:00:00.000Z',
        },
      ]),
    },
    conversations: { listRecentConversationsByKey: vi.fn(() => []) },
    reflections: {
      listReflectionsByKey: vi.fn(() => []),
      addReflection: vi.fn(),
    },
    proposals: { addProposal: vi.fn() },
    sleeps: {
      addSleepRun: vi.fn(),
      updateSleepRun: vi.fn(),
    },
    states: { updateAgentState: vi.fn() },
    tasks: {
      addTask: vi.fn(),
      updateTask: vi.fn(),
    },
    events: { addEvent: vi.fn() },
    ...overrides,
  } satisfies Parameters<typeof runManualAgentSleep>[0]
}

describe('agent sleep service', () => {
  it('returns an organizing report with product sections', async () => {
    const result = await runManualAgentSleep(createSleepInput())

    expect(result.organizingReport).toMatchObject({
      title: '整理报告',
      summary: '整理完成。',
      sections: [
        { title: '新记忆' },
        { title: '合并建议' },
        { title: '删除建议' },
        { title: '行动建议' },
        { title: '作品建议' },
      ],
    })
  })

  it('emits an organizing report event without raw model payload', async () => {
    const events = { addEvent: vi.fn() }

    await runManualAgentSleep(createSleepInput({ events }))

    expect(events.addEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'organizing_report.completed',
      title: '整理报告',
      summary: '整理完成。',
      targetType: 'sleep',
    }))
    expect(JSON.stringify(events.addEvent.mock.calls.at(-1)?.[0])).not.toContain('用户喜欢长句')
  })

  it('does not include rejected memories in sleep consolidation prompts', async () => {
    const input = createSleepInput()

    await runManualAgentSleep(input)

    const messages = input.client.reflectAgent.mock.calls[0][0]
    const text = messages.map(message => String(message.content)).join('\n')

    expect(text).toContain('用户喜欢短句。')
    expect(text).not.toContain('用户喜欢长句。')
  })
})
