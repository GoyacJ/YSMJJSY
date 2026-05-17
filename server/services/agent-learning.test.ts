import { describe, expect, it } from 'vitest'
import {
  buildAgentReflectionMessages,
  parseAgentReflectionResult,
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
})
