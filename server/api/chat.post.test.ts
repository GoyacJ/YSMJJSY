import { describe, expect, it } from 'vitest'
import { buildStarChatMessages } from './chat.post'

describe('chat api helpers', () => {
  it('includes persona, letter, memories, and user message', () => {
    const messages = buildStarChatMessages({
      userMessage: '这封信是真的吗？',
      memories: ['她喜欢星空'],
      recentConversation: [],
    })

    expect(JSON.stringify(messages)).toContain('星信')
    expect(JSON.stringify(messages)).toContain('这封信是真的吗')
    expect(JSON.stringify(messages)).toContain('她喜欢星空')
  })
})
