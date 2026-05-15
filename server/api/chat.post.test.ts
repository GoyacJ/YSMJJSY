import { describe, expect, it } from 'vitest'
import { buildStarChatMessages } from './chat.post'

describe('chat api helpers', () => {
  it('includes persona, letter, memories, and user message', () => {
    const messages = buildStarChatMessages({
      userMessage: '这封信是真的吗？',
      assistantName: '星信',
      mbti: 'INTJ',
      memories: ['她喜欢星空'],
      recentConversation: [],
    })

    expect(JSON.stringify(messages)).toContain('星信')
    expect(JSON.stringify(messages)).toContain('MBTI 性格设定：INTJ')
    expect(JSON.stringify(messages)).toContain('这封信是真的吗')
    expect(JSON.stringify(messages)).toContain('她喜欢星空')
  })

  it('adds image descriptions to the user message context', () => {
    const messages = buildStarChatMessages({
      userMessage: '看看这张图',
      imageDescription: '图片里是一片星空。',
      attachmentNotes: [],
      assistantName: '星信',
      mbti: 'INTJ',
      memories: [],
      recentConversation: [],
    })

    expect(messages.at(-1)).toEqual({
      role: 'user',
      content: '看看这张图\n\n用户附带图片描述：图片里是一片星空。',
    })
  })

  it('adds audio and video attachment metadata to context', () => {
    const messages = buildStarChatMessages({
      userMessage: '看看附件',
      attachmentNotes: [
        '用户附带了一个音频文件：voice.mp3，类型 audio/mpeg。当前版本不直接解析该文件内容。',
        '用户附带了一个视频文件：clip.mp4，类型 video/mp4。当前版本不直接解析该文件内容。',
      ],
      assistantName: '星信',
      mbti: 'INTJ',
      memories: [],
      recentConversation: [],
    })

    expect(String(messages.at(-1)?.content)).toContain('voice.mp3')
    expect(String(messages.at(-1)?.content)).toContain('clip.mp4')
  })
})
