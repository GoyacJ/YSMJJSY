import { describe, expect, it } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createAttachmentRepository,
  createConversationRepository,
  createKeyProfileRepository,
  createMediaTaskRepository,
  createMemoryRepository,
  createUsageLimitRepository,
} from './sqlite'

describe('sqlite repositories', () => {
  it('stores and reads memories', () => {
    const repo = createMemoryRepository(':memory:')

    repo.addMemory({
      id: 'm1',
      type: 'emotion',
      content: '她喜欢星空部分',
      importance: 0.8,
      createdAt: '2026-05-15T00:00:00.000Z',
    })

    expect(repo.listMemories()).toHaveLength(1)
  })

  it('creates and finds a key profile by lookup hash', () => {
    const repo = createKeyProfileRepository(':memory:')

    repo.addKeyProfile({
      id: 'key_1',
      keyLookupHash: 'lookup',
      assistantName: '',
      mbti: '',
      configuredAt: null,
      createdIpHash: 'ip_hash',
      createdAt: '2026-05-16T00:00:00.000Z',
      updatedAt: '2026-05-16T00:00:00.000Z',
    })

    expect(repo.findByLookupHash('lookup')?.id).toBe('key_1')
  })

  it('stores usage limits by key and date', () => {
    const repo = createUsageLimitRepository(':memory:')

    repo.incrementUsage({
      keyId: 'key_1',
      ipHash: 'ip_hash',
      date: '2026-05-16',
      bucket: 'chat',
    })

    expect(repo.getUsage('key_1', '2026-05-16')?.chatCount).toBe(1)
  })

  it('lists recent conversations by key only', () => {
    const repo = createConversationRepository(':memory:')

    repo.addConversation({
      id: 'c1',
      keyId: 'key_1',
      role: 'user',
      content: 'key 1',
      createdAt: '2026-05-16T00:00:00.000Z',
    })
    repo.addConversation({
      id: 'c2',
      keyId: 'key_2',
      role: 'user',
      content: 'key 2',
      createdAt: '2026-05-16T00:01:00.000Z',
    })

    expect(repo.listRecentConversationsByKey('key_1').map(item => item.content)).toEqual(['key 1'])
  })

  it('stores structured conversation message json', () => {
    const repo = createConversationRepository(':memory:')

    repo.addConversation({
      id: 'c1',
      keyId: 'key_1',
      role: 'assistant',
      content: '生成好了。',
      messageJson: JSON.stringify({
        role: 'assistant',
        content: '生成好了。',
        parts: [{ type: 'image', base64: 'img' }],
      }),
      createdAt: '2026-05-16T00:00:00.000Z',
    })

    expect(repo.listRecentConversationsByKey('key_1')[0]?.messageJson).toContain('"image"')
  })

  it('lists memories by key only', () => {
    const repo = createMemoryRepository(':memory:')

    repo.addMemory({
      id: 'm1',
      keyId: 'key_1',
      type: 'emotion',
      content: 'key 1 memory',
      importance: 0.8,
      createdAt: '2026-05-16T00:00:00.000Z',
    })
    repo.addMemory({
      id: 'm2',
      keyId: 'key_2',
      type: 'emotion',
      content: 'key 2 memory',
      importance: 0.8,
      createdAt: '2026-05-16T00:00:00.000Z',
    })

    expect(repo.listMemoriesByKey('key_1').map(item => item.content)).toEqual(['key 1 memory'])
  })

  it('gets media tasks by key only', () => {
    const repo = createMediaTaskRepository(':memory:')

    repo.addMediaTask({
      id: 'task_1',
      keyId: 'key_1',
      type: 'video',
      providerTaskId: null,
      status: 'pending',
      prompt: 'star',
      resultUrl: null,
      error: null,
      createdAt: '2026-05-16T00:00:00.000Z',
      updatedAt: '2026-05-16T00:00:00.000Z',
    })

    expect(repo.getMediaTaskByKey('key_1', 'task_1')?.id).toBe('task_1')
    expect(repo.getMediaTaskByKey('key_2', 'task_1')).toBeUndefined()
  })

  it('stores attachments by key and conversation', () => {
    const path = join(tmpdir(), `ysmjjsy-attachment-${Date.now()}-${Math.random()}.sqlite`)
    const profiles = createKeyProfileRepository(path)
    const repo = createAttachmentRepository(path)

    profiles.addKeyProfile({
      id: 'key_1',
      keyLookupHash: 'lookup_attachment',
      assistantName: '',
      mbti: '',
      configuredAt: null,
      createdIpHash: 'ip_hash',
      createdAt: '2026-05-16T00:00:00.000Z',
      updatedAt: '2026-05-16T00:00:00.000Z',
    })
    repo.addAttachment({
      id: 'att_1',
      keyId: 'key_1',
      conversationId: 'c1',
      type: 'audio',
      mimeType: 'audio/mpeg',
      filename: 'voice.mp3',
      dataUrl: 'data:audio/mpeg;base64,abc',
      createdAt: '2026-05-16T00:00:00.000Z',
    })

    expect(repo.listAttachmentsByConversation('key_1', 'c1')).toHaveLength(1)
    expect(repo.listAttachmentsByConversation('key_2', 'c1')).toHaveLength(0)
  })
})
