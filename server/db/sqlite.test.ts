import { describe, expect, it } from 'vitest'
import {
  createKeyProfileRepository,
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
})
