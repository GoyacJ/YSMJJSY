import { describe, expect, it } from 'vitest'
import { createMemoryRepository } from './sqlite'

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
})
