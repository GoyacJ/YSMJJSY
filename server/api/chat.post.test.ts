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

  it('adds image descriptions to the user message context', () => {
    const messages = buildStarChatMessages({
      userMessage: '看看这张图',
      imageDescription: '图片里是一片星空。',
      memories: [],
      recentConversation: [],
    })

    expect(messages.at(-1)).toEqual({
      role: 'user',
      content: '看看这张图\n\n用户附带图片描述：图片里是一片星空。',
    })
  })
})
