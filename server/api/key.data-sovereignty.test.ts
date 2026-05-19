import { afterEach, describe, expect, it, vi } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readBody } from 'h3'
import exportChatHandler from './key/export/chat.get'
import exportMemoriesHandler from './key/export/memories.get'
import clearChatHandler from './key/chat/clear.post'
import clearMemoriesHandler from './key/memories/clear.post'
import { createConversationRepository, createMemoryEventRepository, createMemoryRepository } from '../db/sqlite'

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()

  return {
    ...actual,
    readBody: vi.fn(),
  }
})

function createSqlitePath(name: string) {
  return join(tmpdir(), `ysmjjsy-${name}-${Date.now()}-${Math.random()}.sqlite`)
}

function stubRuntimeConfig(sqlitePath: string) {
  vi.stubGlobal('useRuntimeConfig', () => ({ sqlitePath }))
}

function keyEvent(keyId?: string) {
  return {
    context: keyId ? { keyId } : {},
  } as any
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('key data sovereignty api routes', () => {
  it('exports chat records only for the current key without raw message json', async () => {
    const sqlitePath = createSqlitePath('chat-export')
    const conversations = createConversationRepository(sqlitePath)
    stubRuntimeConfig(sqlitePath)

    conversations.addConversation({
      id: 'c1',
      keyId: 'key_1',
      role: 'user',
      content: 'key 1 chat',
      messageJson: JSON.stringify({ rawProviderBody: 'hidden-provider-body' }),
      createdAt: '2026-05-19T00:00:00.000Z',
    })
    conversations.addConversation({
      id: 'c2',
      keyId: 'key_2',
      role: 'user',
      content: 'key 2 chat',
      createdAt: '2026-05-19T00:01:00.000Z',
    })

    const result = await exportChatHandler(keyEvent('key_1'))

    expect(result.conversations).toEqual([{
      id: 'c1',
      role: 'user',
      content: 'key 1 chat',
      createdAt: '2026-05-19T00:00:00.000Z',
    }])
    expect(JSON.stringify(result)).not.toContain('hidden-provider-body')
    expect(JSON.stringify(result)).not.toContain('key 2 chat')
    expect(result.exportedAt).toEqual(expect.any(String))
  })

  it('exports memory records only for the current key without session or hash fields', async () => {
    const sqlitePath = createSqlitePath('memory-export')
    const memories = createMemoryRepository(sqlitePath)
    stubRuntimeConfig(sqlitePath)

    memories.addMemory({
      id: 'm1',
      keyId: 'key_1',
      type: 'preference',
      content: 'key 1 memory',
      importance: 0.8,
      confidence: 0.9,
      sourceConversationId: 'c1',
      sourceAttachmentId: 'a1',
      status: 'active',
      updatedAt: '2026-05-19T00:02:00.000Z',
      createdAt: '2026-05-19T00:00:00.000Z',
    })
    memories.addMemory({
      id: 'm2',
      keyId: 'key_2',
      type: 'preference',
      content: 'key 2 memory',
      importance: 0.7,
      createdAt: '2026-05-19T00:01:00.000Z',
    })

    const result = await exportMemoriesHandler(keyEvent('key_1'))

    expect(result.memories).toEqual([{
      id: 'm1',
      type: 'preference',
      content: 'key 1 memory',
      importance: 0.8,
      confidence: 0.9,
      sourceConversationId: 'c1',
      sourceAttachmentId: 'a1',
      status: 'active',
      updatedAt: '2026-05-19T00:02:00.000Z',
      createdAt: '2026-05-19T00:00:00.000Z',
    }])
    expect(JSON.stringify(result)).not.toContain('key 2 memory')
    expect(JSON.stringify(result)).not.toContain('keyLookupHash')
    expect(JSON.stringify(result)).not.toContain('session')
    expect(result.exportedAt).toEqual(expect.any(String))
  })

  it('requires explicit confirmation before clearing chat and only clears the current key', async () => {
    const sqlitePath = createSqlitePath('chat-clear')
    const conversations = createConversationRepository(sqlitePath)
    stubRuntimeConfig(sqlitePath)

    conversations.addConversation({
      id: 'c1',
      keyId: 'key_1',
      role: 'user',
      content: 'key 1 chat',
      createdAt: '2026-05-19T00:00:00.000Z',
    })
    conversations.addConversation({
      id: 'c2',
      keyId: 'key_2',
      role: 'user',
      content: 'key 2 chat',
      createdAt: '2026-05-19T00:01:00.000Z',
    })

    vi.mocked(readBody).mockResolvedValueOnce({ confirm: 'WRONG' })
    await expect(clearChatHandler(keyEvent('key_1'))).rejects.toMatchObject({ statusCode: 400 })

    vi.mocked(readBody).mockResolvedValueOnce({ confirm: 'DELETE' })
    await expect(clearChatHandler(keyEvent('key_1'))).resolves.toEqual({ deleted: 1 })

    expect(conversations.listConversationsByKey('key_1')).toEqual([])
    expect(conversations.listConversationsByKey('key_2').map(item => item.content)).toEqual(['key 2 chat'])
  })

  it('requires explicit confirmation before clearing memories and writes minimal delete events', async () => {
    const sqlitePath = createSqlitePath('memory-clear')
    const memories = createMemoryRepository(sqlitePath)
    const memoryEvents = createMemoryEventRepository(sqlitePath)
    stubRuntimeConfig(sqlitePath)

    memories.addMemory({
      id: 'm1',
      keyId: 'key_1',
      type: 'preference',
      content: 'private memory text',
      importance: 0.8,
      status: 'pending',
      createdAt: '2026-05-19T00:00:00.000Z',
    })
    memories.addMemory({
      id: 'm2',
      keyId: 'key_2',
      type: 'preference',
      content: 'other key memory',
      importance: 0.7,
      createdAt: '2026-05-19T00:01:00.000Z',
    })

    vi.mocked(readBody).mockResolvedValueOnce({ confirm: 'WRONG' })
    await expect(clearMemoriesHandler(keyEvent('key_1'))).rejects.toMatchObject({ statusCode: 400 })

    vi.mocked(readBody).mockResolvedValueOnce({ confirm: 'DELETE' })
    await expect(clearMemoriesHandler(keyEvent('key_1'))).resolves.toEqual({ deleted: 1 })

    const events = memoryEvents.listMemoryEventsByKey('key_1')

    expect(memories.listMemoriesByKey('key_1')).toEqual([])
    expect(memories.listMemoriesByKey('key_2').map(item => item.content)).toEqual(['other key memory'])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ memoryId: 'm1', action: 'delete' })
    expect(events[0].beforeJson).not.toContain('private memory text')
    expect(events[0].afterJson).not.toContain('private memory text')
    expect(JSON.parse(events[0].afterJson)).toEqual({
      importance: 0.8,
      status: 'pending',
      deleted: true,
    })
  })

  it('rejects data export and clear requests without a current key', async () => {
    await expect(() => exportChatHandler(keyEvent())).toThrow(expect.objectContaining({ statusCode: 401 }))

    await expect(clearChatHandler(keyEvent())).rejects.toMatchObject({ statusCode: 401 })
    expect(readBody).not.toHaveBeenCalled()
  })
})
