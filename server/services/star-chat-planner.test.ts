import { describe, expect, it } from 'vitest'
import { parseStarChatTurnPlan } from './star-chat-planner'

describe('star chat planner', () => {
  it('parses a valid turn plan', () => {
    expect(parseStarChatTurnPlan(JSON.stringify({
      reply: '可以。',
      toolSearches: [{ query: '发布作品', category: 'publish', behavior: 'publish', limit: 3 }],
      toolCalls: [
        {
          toolName: 'star.publishWork',
          input: { workId: 'work_1' },
          mode: 'propose',
          evidence: '用户说想公开这张图。',
          reason: '发布前需要确认。',
        },
      ],
    }))).toEqual({
      reply: '可以。',
      toolSearches: [{ query: '发布作品', category: 'publish', behavior: 'publish', limit: 3 }],
      toolCalls: [
        {
          toolName: 'star.publishWork',
          input: { workId: 'work_1' },
          mode: 'propose',
          evidence: '用户说想公开这张图。',
          reason: '发布前需要确认。',
        },
      ],
    })
  })

  it('parses markdown wrapped JSON', () => {
    expect(parseStarChatTurnPlan('```json\n{"reply":"你好","toolCalls":[]}\n```')).toEqual({
      reply: '你好',
      toolSearches: [],
      toolCalls: [],
    })
  })

  it('returns a fallback plan for invalid JSON', () => {
    expect(parseStarChatTurnPlan('not json')).toEqual({
      reply: '',
      toolSearches: [],
      toolCalls: [],
    })
  })

  it('rejects unknown tool call modes', () => {
    expect(parseStarChatTurnPlan(JSON.stringify({
      reply: 'x',
      toolCalls: [{ toolName: 'star.generateImage', input: {}, mode: 'run' }],
    }))).toEqual({
      reply: '',
      toolSearches: [],
      toolCalls: [],
    })
  })

  it('requires tool call input to be an object', () => {
    expect(parseStarChatTurnPlan(JSON.stringify({
      reply: 'x',
      toolCalls: [{ toolName: 'star.generateImage', input: 'bad', mode: 'execute' }],
    }))).toEqual({
      reply: '',
      toolSearches: [],
      toolCalls: [],
    })
  })
})
