import { describe, expect, it } from 'vitest'
import { buildChatHistoryResponse, normalizeHistoryLimit } from './history.get'

describe('chat history api helpers', () => {
  it('maps saved conversations to chat messages for one key', () => {
    expect(buildChatHistoryResponse([
      {
        id: 'c1',
        keyId: 'key_1',
        role: 'user',
        content: '昨晚说到星空。',
        createdAt: '2026-05-16T00:00:00.000Z',
      },
      {
        id: 'c2',
        keyId: 'key_1',
        role: 'assistant',
        content: '我还记得那片星空。',
        createdAt: '2026-05-16T00:01:00.000Z',
      },
      {
        id: 'c3',
        keyId: 'key_1',
        role: 'system',
        content: 'hidden',
        createdAt: '2026-05-16T00:02:00.000Z',
      },
    ])).toEqual({
      messages: [
        { role: 'user', content: '昨晚说到星空。' },
        {
          role: 'assistant',
          content: '我还记得那片星空。',
          parts: [{ type: 'text', text: '我还记得那片星空。' }],
        },
      ],
    })
  })

  it('restores stored structured media messages', () => {
    expect(buildChatHistoryResponse([
      {
        id: 'c1',
        keyId: 'key_1',
        role: 'assistant',
        content: '生成好了。',
        messageJson: JSON.stringify({
          role: 'assistant',
          content: '生成好了。',
          parts: [
            { type: 'text', text: '生成好了。' },
            { type: 'image', base64: 'img' },
            { type: 'audio', base64: 'audio' },
            { type: 'music', base64: 'song' },
            { type: 'video', url: 'https://example.com/star.mp4' },
          ],
        }),
        createdAt: '2026-05-16T00:00:00.000Z',
      },
    ])).toEqual({
      messages: [{
        role: 'assistant',
        content: '生成好了。',
        parts: [
          { type: 'text', text: '生成好了。' },
          { type: 'image', base64: 'img' },
          { type: 'audio', base64: 'audio' },
          { type: 'music', base64: 'song' },
          { type: 'video', url: 'https://example.com/star.mp4' },
        ],
      }],
    })
  })

  it('restores stored user attachment parts', () => {
    expect(buildChatHistoryResponse([
      {
        id: 'c1',
        keyId: 'key_1',
        role: 'user',
        content: '发送了一个附件',
        messageJson: JSON.stringify({
          role: 'user',
          content: '发送了一个附件',
          parts: [
            { type: 'text', text: '发送了一个附件' },
            { type: 'audio', url: 'data:audio/mpeg;base64,audio' },
            { type: 'video', url: 'data:video/mp4;base64,video' },
          ],
        }),
        createdAt: '2026-05-16T00:00:00.000Z',
      },
    ])).toEqual({
      messages: [{
        role: 'user',
        content: '发送了一个附件',
        parts: [
          { type: 'text', text: '发送了一个附件' },
          { type: 'audio', url: 'data:audio/mpeg;base64,audio' },
          { type: 'video', url: 'data:video/mp4;base64,video' },
        ],
      }],
    })
  })

  it('hydrates completed async music parts from media tasks', () => {
    expect(buildChatHistoryResponse([
      {
        id: 'c1',
        keyId: 'key_1',
        role: 'assistant',
        content: '音乐生成已开始。',
        messageJson: JSON.stringify({
          role: 'assistant',
          content: '音乐生成已开始。',
          parts: [
            { type: 'text', text: '音乐生成已开始。' },
            { type: 'music', status: 'processing', taskId: 'media_task_1' },
          ],
        }),
        createdAt: '2026-05-16T00:00:00.000Z',
      },
    ], {
      keyId: 'key_1',
      mediaTasks: {
        getMediaTaskByKey: () => ({
          id: 'media_task_1',
          keyId: 'key_1',
          type: 'music',
          providerTaskId: 'provider_1',
          status: 'succeeded',
          prompt: '写一首歌',
          resultUrl: 'https://example.com/song.mp3',
          error: null,
          createdAt: '2026-05-16T00:00:00.000Z',
          updatedAt: '2026-05-16T00:01:00.000Z',
        }),
      },
    })).toEqual({
      messages: [{
        role: 'assistant',
        content: '音乐生成已开始。',
        parts: [
          { type: 'text', text: '音乐生成已开始。' },
          {
            type: 'music',
            status: 'succeeded',
            taskId: 'media_task_1',
            providerTaskId: 'provider_1',
            url: 'https://example.com/song.mp3',
          },
        ],
      }],
    })
  })

  it('clamps requested history limits', () => {
    expect(normalizeHistoryLimit('2')).toBe(2)
    expect(normalizeHistoryLimit('1000')).toBe(100)
    expect(normalizeHistoryLimit('bad')).toBe(50)
  })
})
