import { describe, expect, it } from 'vitest'
import {
  buildStarChatMessages,
  selectAcceptedEvolutionNotes,
  selectActiveMemoryContents,
} from './star-chat'

describe('star chat prompt state', () => {
  it('includes agent tone and relationship role', () => {
    const messages = buildStarChatMessages({
      userMessage: '在吗',
      memories: [],
      recentConversation: [],
      tone: '短句、克制',
      relationshipRole: '长期陪伴者',
    })

    const system = String(messages[0]?.content)

    expect(system).toContain('语气：短句、克制')
    expect(system).toContain('关系角色：长期陪伴者')
  })

  it('includes agent content strategy', () => {
    const messages = buildStarChatMessages({
      userMessage: '今天怎么聊？',
      assistantName: '月光',
      mbti: 'INTJ',
      tone: '更短',
      relationshipRole: '长期记忆守护者',
      contentStrategy: { replyLength: 'short', structure: 'plain', initiative: 'low' },
      memories: [],
      recentConversation: [],
    })

    expect(messages[0].content).toContain('语气：更短')
    expect(messages[0].content).toContain('关系角色：长期记忆守护者')
    expect(messages[0].content).toContain('回复长度：short')
  })

  it('excludes rejected proposals from accepted evolution notes', () => {
    expect(selectAcceptedEvolutionNotes([
      {
        id: 'p1',
        keyId: 'key_1',
        reflectionId: 'r1',
        type: 'tone',
        title: '更短',
        summary: '回复更短。',
        payloadJson: '{}',
        status: 'accepted',
        createdAt: '2026-05-17T00:00:00.000Z',
        updatedAt: '2026-05-17T00:00:00.000Z',
      },
      {
        id: 'p2',
        keyId: 'key_1',
        reflectionId: 'r1',
        type: 'tone',
        title: '被拒绝',
        summary: '不要出现。',
        payloadJson: '{}',
        status: 'rejected',
        createdAt: '2026-05-17T00:00:00.000Z',
        updatedAt: '2026-05-17T00:00:00.000Z',
      },
    ])).toEqual(['回复更短。'])
  })

  it('includes active high-importance memories', () => {
    expect(selectActiveMemoryContents([
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
    ])).toEqual(['用户喜欢短句。'])
  })

  it('excludes archived or rejected memories', () => {
    expect(selectActiveMemoryContents([
      {
        id: 'm1',
        keyId: 'key_1',
        type: 'preference',
        content: '旧记忆。',
        importance: 0.8,
        confidence: 0.9,
        status: 'archived',
        createdAt: '2026-05-17T00:00:00.000Z',
      },
      {
        id: 'm2',
        keyId: 'key_1',
        type: 'preference',
        content: '拒绝记忆。',
        importance: 0.8,
        confidence: 0.9,
        status: 'rejected',
        createdAt: '2026-05-17T00:00:00.000Z',
      },
    ])).toEqual([])
  })
})
