import { describe, expect, it } from 'vitest'
import {
  buildAgentReflectionMessages,
  calculateNextSleepAt,
  filterRejectedLearnedMemories,
  parseAgentSleepResult,
  parseAgentReflectionResult,
  shouldScheduleAgentSleep,
} from './agent-learning'

describe('agent learning service', () => {
  it('builds reflection messages with conversation, memories, and profile', () => {
    const messages = buildAgentReflectionMessages({
      userMessage: '我喜欢你回复短一点。',
      assistantReply: '好，我会短一点。',
      memories: ['用户喜欢星空。'],
      profile: {
        assistantName: '阿月',
        mbti: 'INTJ',
      },
    })

    const text = messages.map(message => String(message.content)).join('\n')

    expect(text).toContain('我喜欢你回复短一点。')
    expect(text).toContain('好，我会短一点。')
    expect(text).toContain('用户喜欢星空。')
    expect(text).toContain('阿月')
    expect(text).toContain('INTJ')
  })

  it('parses valid reflection JSON', () => {
    expect(parseAgentReflectionResult(JSON.stringify({
      summary: '用户明确偏好短句。',
      learned: [
        {
          shouldRemember: true,
          type: 'preference',
          content: '用户喜欢短句。',
          importance: 0.8,
          confidence: 0.9,
        },
      ],
      proposals: [
        {
          type: 'tone',
          title: '更短',
          summary: '回复更短。',
          payload: { tone: 'concise' },
        },
      ],
    }))).toEqual({
      summary: '用户明确偏好短句。',
      learned: [
        {
          type: 'preference',
          content: '用户喜欢短句。',
          importance: 0.8,
          confidence: 0.9,
          status: 'active',
        },
      ],
      proposals: [
        {
          type: 'tone',
          title: '更短',
          summary: '回复更短。',
          payload: { tone: 'concise' },
        },
      ],
    })
  })

  it('discards invalid proposal types', () => {
    const result = parseAgentReflectionResult(JSON.stringify({
      summary: 'summary',
      learned: [],
      proposals: [
        {
          type: 'unsupported',
          title: 'bad',
          summary: 'bad',
          payload: {},
        },
      ],
    }))

    expect(result.proposals).toEqual([])
  })

  it('discards invalid memory types', () => {
    const result = parseAgentReflectionResult(JSON.stringify({
      summary: 'summary',
      learned: [
        {
          shouldRemember: true,
          type: 'unsupported',
          content: 'bad',
          importance: 0.9,
          confidence: 0.9,
        },
      ],
      proposals: [],
    }))

    expect(result.learned).toEqual([])
  })

  it('parses a sleep run result', () => {
    const result = parseAgentSleepResult(JSON.stringify({
      dailySummary: '今天用户确认了短句偏好。',
      memoryActions: [
        { memoryId: 'm1', action: 'confirm', reason: '用户明确表达。' },
      ],
      proposals: [
        {
          type: 'tone',
          title: '更短',
          summary: '后续回复更短。',
          payload: { tone: '更短' },
        },
      ],
      workIdeas: [
        { type: 'letter', title: '短句回信', summary: '写一封短回信。' },
      ],
      nextConversationHints: ['可以承接短句偏好。'],
    }))

    expect(result.dailySummary).toBe('今天用户确认了短句偏好。')
    expect(result.memoryActions[0]).toMatchObject({ memoryId: 'm1', action: 'confirm' })
    expect(result.proposals[0]).toMatchObject({ type: 'tone' })
  })

  it('schedules sleep when there is no next sleep time and new content exists', () => {
    expect(shouldScheduleAgentSleep({
      lastSleepAt: null,
      nextSleepAt: null,
      now: '2026-05-18T00:00:00.000Z',
      newConversationCount: 1,
    })).toBe(true)
  })

  it('does not schedule sleep before the next sleep time', () => {
    expect(shouldScheduleAgentSleep({
      lastSleepAt: '2026-05-17T00:00:00.000Z',
      nextSleepAt: '2026-05-18T12:00:00.000Z',
      now: '2026-05-18T00:00:00.000Z',
      newConversationCount: 1,
    })).toBe(false)
  })

  it('schedules sleep when the next sleep time has passed and new content exists', () => {
    expect(shouldScheduleAgentSleep({
      lastSleepAt: '2026-05-17T00:00:00.000Z',
      nextSleepAt: '2026-05-17T12:00:00.000Z',
      now: '2026-05-18T00:00:00.000Z',
      newConversationCount: 1,
    })).toBe(true)
  })

  it('calculates the next sleep reminder twelve hours later', () => {
    expect(calculateNextSleepAt('2026-05-18T00:00:00.000Z')).toBe('2026-05-18T12:00:00.000Z')
  })

  it('filters learned memories similar to rejected memories', () => {
    expect(filterRejectedLearnedMemories([
      {
        type: 'preference',
        content: '用户喜欢短句。',
        importance: 0.8,
        confidence: 0.9,
        status: 'active',
      },
      {
        type: 'preference',
        content: '用户喜欢蓝色。',
        importance: 0.8,
        confidence: 0.9,
        status: 'active',
      },
    ], ['用户喜欢短句。']).map(memory => memory.content)).toEqual(['用户喜欢蓝色。'])
  })
})
