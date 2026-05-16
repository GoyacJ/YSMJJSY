import { describe, expect, it, vi } from 'vitest'
import { buildStarChatMessages, streamStarChatReply } from '../services/star-chat'

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

  it('streams chat deltas and finishes with a structured message', async () => {
    const client = {
      chat: vi.fn(),
      chatStream: vi.fn(async function* () {
        yield '你'
        yield '好'
      }),
      textToSpeech: vi.fn(),
      textToSpeechStream: vi.fn(),
      generateImage: vi.fn(),
      generateMusic: vi.fn(),
      generateMusicStream: vi.fn(),
      createVideoTask: vi.fn(),
    }
    const events: any[] = []

    await streamStarChatReply({
      client,
      intent: 'chat',
      messages: [{ role: 'user', content: '在吗' }],
      prompt: '在吗',
      emit: event => events.push(event),
    })

    expect(events).toEqual([
      { type: 'delta', text: '你' },
      { type: 'delta', text: '好' },
      {
        type: 'message',
        reply: '你好',
        message: {
          role: 'assistant',
          content: '你好',
          parts: [{ type: 'text', text: '你好' }],
        },
      },
    ])
  })

  it('streams audio text first and finishes with audio in the message', async () => {
    const client = {
      chat: vi.fn(),
      chatStream: vi.fn(async function* () {
        yield '星信回复'
      }),
      textToSpeech: vi.fn(),
      textToSpeechStream: vi.fn(async function* () {
        yield '4944'
        yield '33'
      }),
      generateImage: vi.fn(),
      generateMusic: vi.fn(),
      generateMusicStream: vi.fn(),
      createVideoTask: vi.fn(),
    }
    const events: any[] = []

    await streamStarChatReply({
      client,
      intent: 'audio',
      messages: [{ role: 'user', content: '读给我听' }],
      prompt: '读给我听',
      emit: event => events.push(event),
    })

    expect(client.textToSpeechStream).toHaveBeenCalledWith('星信回复')
    expect(events).toContainEqual({ type: 'audio-delta', hex: '4944' })
    expect(events).toContainEqual({ type: 'audio-delta', hex: '33' })
    expect(events.at(-1)).toEqual({
      type: 'message',
      reply: '星信回复',
      message: {
        role: 'assistant',
        content: '星信回复',
        parts: [
          { type: 'text', text: '星信回复' },
          { type: 'audio', base64: 'SUQz' },
        ],
      },
    })
  })

  it('returns one-shot image through stream events without calling chat', async () => {
    const client = {
      chat: vi.fn(),
      chatStream: vi.fn(),
      textToSpeech: vi.fn(),
      textToSpeechStream: vi.fn(),
      generateImage: vi.fn(async () => ({ url: 'https://example.com/star.png' })),
      generateMusic: vi.fn(),
      generateMusicStream: vi.fn(),
      createVideoTask: vi.fn(),
    }
    const events: any[] = []

    const response = await streamStarChatReply({
      client,
      intent: 'image',
      messages: [{ role: 'user', content: '画一张星空' }],
      prompt: '画一张星空',
      emit: event => events.push(event),
    })

    expect(client.chat).not.toHaveBeenCalled()
    expect(client.chatStream).not.toHaveBeenCalled()
    expect(client.generateImage).toHaveBeenCalled()
    expect(events[0]).toEqual({ type: 'status', text: '正在画一张。' })
    expect(response.message.parts).toEqual([
      { type: 'text', text: '画好了。' },
      { type: 'image', url: 'https://example.com/star.png' },
    ])
  })

  it('streams music and returns a final music message', async () => {
    const client = {
      chat: vi.fn(),
      chatStream: vi.fn(),
      textToSpeech: vi.fn(),
      textToSpeechStream: vi.fn(),
      generateImage: vi.fn(),
      generateMusic: vi.fn(),
      generateMusicStream: vi.fn(async function* () {
        yield '4944'
        yield '33'
      }),
      createVideoTask: vi.fn(async () => ({ providerTaskId: 'task-1' })),
    }
    const events: any[] = []

    const music = await streamStarChatReply({
      client,
      intent: 'music',
      messages: [{ role: 'user', content: '写一首歌' }],
      prompt: '写一首歌',
      emit: event => events.push(event),
    })

    expect(client.generateMusicStream).toHaveBeenCalledWith('写一首歌')
    expect(client.generateMusic).not.toHaveBeenCalled()
    expect(events).toContainEqual({ type: 'music-delta', hex: '4944' })
    expect(events).toContainEqual({ type: 'music-delta', hex: '33' })
    expect(music.message.parts).toEqual([
      { type: 'text', text: '写好了。' },
      { type: 'music', base64: 'SUQz' },
    ])
  })

  it('returns video task status through stream events', async () => {
    const client = {
      chat: vi.fn(),
      chatStream: vi.fn(),
      textToSpeech: vi.fn(),
      textToSpeechStream: vi.fn(),
      generateImage: vi.fn(),
      generateMusic: vi.fn(),
      generateMusicStream: vi.fn(),
      createVideoTask: vi.fn(async () => ({ providerTaskId: 'task-1' })),
    }
    const events: any[] = []

    const video = await streamStarChatReply({
      client,
      intent: 'video',
      messages: [{ role: 'user', content: '做一段视频' }],
      prompt: '做一段视频',
      emit: event => events.push(event),
    })

    expect(events[0]).toEqual({ type: 'status', text: '视频开始生成了。' })
    expect(video.message.parts).toEqual([{ type: 'status', text: '视频开始生成了。' }])
    expect(video.taskId).toBe('task-1')
  })
})
