import { describe, expect, it, vi } from 'vitest'
import { applyMemoryGovernanceAction } from './agent/memories/[id].put'

describe('agent memory api helpers', () => {
  it('archives a memory and records before and after snapshots', () => {
    const updateMemory = vi.fn()
    const addMemoryEvent = vi.fn()

    const result = applyMemoryGovernanceAction({
      keyId: 'key_1',
      memoryId: 'memory_1',
      action: 'archive',
      reason: '不再使用',
      now: '2026-05-17T00:00:00.000Z',
      memories: {
        getMemoryByKey: () => ({
          id: 'memory_1',
          keyId: 'key_1',
          type: 'preference',
          content: '用户喜欢短句。',
          importance: 0.8,
          confidence: 0.9,
          status: 'active',
          createdAt: '2026-05-17T00:00:00.000Z',
        }),
        updateMemory,
      },
      events: { addMemoryEvent },
    })

    expect(result.status).toBe('archived')
    expect(updateMemory).toHaveBeenCalled()
    expect(addMemoryEvent).toHaveBeenCalled()
  })
})
