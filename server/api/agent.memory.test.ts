import { describe, expect, it, vi } from 'vitest'
import { createAgentToolRegistry } from '../services/agent-runtime'
import { registerStarAgentTools } from '../services/star-agent-tools'
import { applyMemoryGovernanceAction, governMemoryActionOrTask, governMemoryWithTool } from './agent/memories/[id].put'

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

  it('governs memory through star.governMemory tool', async () => {
    const execute = vi.fn(async () => ({ ok: true, output: { id: 'memory_1', status: 'archived' } }))

    const result = await governMemoryWithTool({
      toolName: 'star.governMemory',
      memoryId: 'memory_1',
      action: 'archive',
      reason: '过期。',
      registry: { execute },
    } as any)

    expect(result.status).toBe('archived')
    expect(execute).toHaveBeenCalledWith('star.governMemory', {
      memoryId: 'memory_1',
      action: 'archive',
      reason: '过期。',
    })
  })

  it('requires approval for memory rejection through the agent task runner', async () => {
    const updateMemory = vi.fn()
    const updateTask = vi.fn()
    const addTask = vi.fn()
    const addEvent = vi.fn()
    const registry = createAgentToolRegistry()

    registerStarAgentTools(registry, {
      keyId: 'key_1',
      now: '2026-05-18T00:00:00.000Z',
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
      memoryEvents: { addMemoryEvent: vi.fn() },
    })

    const result = await governMemoryActionOrTask({
      keyId: 'key_1',
      agentId: 'agent_1',
      memoryId: 'memory_1',
      action: 'reject',
      reason: '错误记忆。',
      now: '2026-05-18T00:00:00.000Z',
      memories: {
        getMemoryByKey: vi.fn(),
        updateMemory,
      },
      memoryEvents: { addMemoryEvent: vi.fn() },
      tasks: { addTask, updateTask },
      events: { addEvent },
      registry,
    })

    expect(result.status).toBe('waiting_approval')
    expect(updateTask).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      status: 'waiting_approval',
    }))
    expect(updateMemory).not.toHaveBeenCalled()
  })
})
