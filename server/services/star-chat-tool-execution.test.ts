import { describe, expect, it, vi } from 'vitest'
import { createAgentToolRegistry } from './agent-runtime'
import type { StarChatTurnPlan } from './star-chat-planner'
import { executeStarChatToolCalls, normalizeStarChatToolCalls } from './star-chat-tool-execution'

function createRegistry() {
  const registry = createAgentToolRegistry()

  registry.register({
    name: 'star.generateImage',
    description: 'Generate image.',
    riskLevel: 'medium',
    approvalRequired: false,
    execute: vi.fn(),
  })
  registry.register({
    name: 'star.speakReply',
    description: 'Speak reply.',
    riskLevel: 'low',
    approvalRequired: false,
    execute: vi.fn(),
  })

  return registry
}

describe('star chat tool execution', () => {
  it('rejects unknown tools', () => {
    const calls = normalizeStarChatToolCalls({
      plan: {
        reply: '',
        toolSearches: [],
        toolCalls: [{ toolName: 'missing.tool', input: {}, mode: 'execute', evidence: '', reason: '' }],
      },
      registry: createRegistry(),
      reply: '',
    })

    expect(calls).toEqual([
      expect.objectContaining({
        toolName: 'missing.tool',
        status: 'rejected',
        error: 'Unknown tool',
      }),
    ])
  })

  it('rejects media calls without a prompt', () => {
    const calls = normalizeStarChatToolCalls({
      plan: {
        reply: '',
        toolSearches: [],
        toolCalls: [{ toolName: 'star.generateImage', input: {}, mode: 'execute', evidence: '', reason: '' }],
      },
      registry: createRegistry(),
      reply: '',
    })

    expect(calls[0]).toMatchObject({
      toolName: 'star.generateImage',
      status: 'rejected',
      error: 'Missing prompt',
    })
  })

  it('replaces speak reply placeholder with final reply text', () => {
    const calls = normalizeStarChatToolCalls({
      plan: {
        reply: '你好',
        toolSearches: [],
        toolCalls: [{ toolName: 'star.speakReply', input: { text: '$reply' }, mode: 'execute', evidence: '', reason: '' }],
      },
      registry: createRegistry(),
      reply: '最终回复',
    })

    expect(calls[0]).toMatchObject({
      toolName: 'star.speakReply',
      status: 'ready',
      input: { text: '最终回复' },
    })
  })

  it('caps tool calls at four', () => {
    const plan: StarChatTurnPlan = {
      reply: '',
      toolSearches: [],
      toolCalls: Array.from({ length: 6 }, (_, index) => ({
        toolName: 'star.speakReply',
        input: { text: String(index) },
        mode: 'execute',
        evidence: '',
        reason: '',
      })),
    }

    expect(normalizeStarChatToolCalls({
      plan,
      registry: createRegistry(),
      reply: '',
    })).toHaveLength(4)
  })

  it('creates a waiting approval task for proposed calls', async () => {
    const tasks = { addTask: vi.fn(), updateTask: vi.fn() }
    const events = { addEvent: vi.fn() }
    const registry = createRegistry()
    const calls = normalizeStarChatToolCalls({
      plan: {
        reply: '',
        toolSearches: [],
        toolCalls: [{
          toolName: 'star.generateImage',
          input: { prompt: '星空' },
          mode: 'propose',
          evidence: '用户暗示想要图片。',
          reason: '需要确认。',
        }],
      },
      registry,
      reply: '',
    })

    await expect(executeStarChatToolCalls({
      agentId: 'agent_1',
      now: '2026-05-19T00:00:00.000Z',
      calls,
      tasks,
      events,
      registry,
      policy: { autoRunLowRiskTasks: false } as any,
    })).resolves.toEqual([
      expect.objectContaining({
        toolName: 'star.generateImage',
        status: 'waiting_approval',
        inboxItemId: expect.stringMatching(/^task_approval:/),
      }),
    ])
    expect(tasks.addTask).toHaveBeenCalledWith(expect.objectContaining({ status: 'queued' }))
    expect(tasks.updateTask).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status: 'waiting_approval' }))
  })

  it('runs explicit low-risk retrieval immediately', async () => {
    const tasks = { addTask: vi.fn(), updateTask: vi.fn() }
    const events = { addEvent: vi.fn() }
    const registry = createAgentToolRegistry()

    registry.register({
      name: 'star.searchMemories',
      description: 'Search memories.',
      riskLevel: 'low',
      approvalRequired: false,
      execute: vi.fn(),
    })

    await executeStarChatToolCalls({
      agentId: 'agent_1',
      now: '2026-05-19T00:00:00.000Z',
      calls: [{
        toolName: 'star.searchMemories',
        input: { query: '星空' },
        mode: 'execute',
        evidence: '',
        reason: '',
        status: 'ready',
      }],
      tasks,
      events,
      registry: {
        get: registry.get,
        execute: vi.fn(async () => ({ ok: true, output: { memories: [] } })),
      },
      policy: { autoRunLowRiskTasks: true } as any,
    })

    expect(tasks.updateTask).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status: 'completed' }))
  })

  it('requires approval for high-risk tools even when execution was requested', async () => {
    const tasks = { addTask: vi.fn(), updateTask: vi.fn() }
    const events = { addEvent: vi.fn() }
    const registry = createAgentToolRegistry()

    registry.register({
      name: 'star.publishWork',
      description: 'Publish work.',
      riskLevel: 'high',
      approvalRequired: true,
      execute: vi.fn(),
    })

    await expect(executeStarChatToolCalls({
      agentId: 'agent_1',
      now: '2026-05-19T00:00:00.000Z',
      calls: [{
        toolName: 'star.publishWork',
        input: { workId: 'work_1' },
        mode: 'execute',
        evidence: '',
        reason: '',
        status: 'ready',
      }],
      tasks,
      events,
      registry,
      policy: { requireApprovalForPublishing: true } as any,
    })).resolves.toEqual([
      expect.objectContaining({ status: 'waiting_approval' }),
    ])
  })

  it('returns a safe status when policy denies a tool call', async () => {
    const tasks = { addTask: vi.fn(), updateTask: vi.fn() }
    const events = { addEvent: vi.fn() }
    const registry = createAgentToolRegistry()

    registry.register({
      name: 'star.writeMemory',
      description: 'Write memory.',
      riskLevel: 'medium',
      approvalRequired: false,
      execute: vi.fn(),
    })

    await expect(executeStarChatToolCalls({
      agentId: 'agent_1',
      now: '2026-05-19T00:00:00.000Z',
      calls: [{
        toolName: 'star.writeMemory',
        input: { content: 'secret topic' },
        mode: 'execute',
        evidence: '',
        reason: '',
        status: 'ready',
      }],
      tasks,
      events,
      registry,
      policy: {
        disallowedMemoryTopics: ['secret'],
      } as any,
    })).resolves.toEqual([
      expect.objectContaining({
        toolName: 'star.writeMemory',
        status: 'denied',
      }),
    ])
  })
})
