import { describe, expect, it, vi } from 'vitest'
import { createAgentToolRegistry } from './agent-runtime'
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
    name: 'star.generateMusic',
    description: 'Generate music.',
    riskLevel: 'medium',
    approvalRequired: false,
    execute: vi.fn(),
  })
  registry.register({
    name: 'star.generateVideo',
    description: 'Generate video.',
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
      action: { type: 'tool_call', toolName: 'missing.tool', input: {}, mode: 'execute', reason: '' },
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
      action: { type: 'tool_call', toolName: 'star.generateImage', input: {}, mode: 'execute', reason: '' },
      registry: createRegistry(),
      reply: '',
    })

    expect(calls[0]).toMatchObject({
      toolName: 'star.generateImage',
      status: 'rejected',
      error: 'Missing prompt',
    })
  })

  it('rejects music and video calls without a prompt', () => {
    const registry = createRegistry()
    const calls = [
      ...normalizeStarChatToolCalls({
        action: { type: 'tool_call', toolName: 'star.generateMusic', input: {}, mode: 'execute', reason: '' },
        registry,
        reply: '',
      }),
      ...normalizeStarChatToolCalls({
        action: { type: 'tool_call', toolName: 'star.generateVideo', input: {}, mode: 'execute', reason: '' },
        registry,
        reply: '',
      }),
    ]

    expect(calls).toEqual([
      expect.objectContaining({
        toolName: 'star.generateMusic',
        status: 'rejected',
        error: 'Missing prompt',
      }),
      expect.objectContaining({
        toolName: 'star.generateVideo',
        status: 'rejected',
        error: 'Missing prompt',
      }),
    ])
  })

  it('replaces speak reply placeholder with final reply text', () => {
    const calls = normalizeStarChatToolCalls({
      action: { type: 'tool_call', toolName: 'star.speakReply', input: { text: '$reply' }, mode: 'execute', reason: '' },
      registry: createRegistry(),
      reply: '最终回复',
    })

    expect(calls[0]).toMatchObject({
      toolName: 'star.speakReply',
      status: 'ready',
      input: { text: '最终回复' },
    })
  })

  it('creates a waiting approval task for proposed calls', async () => {
    const tasks = { addTask: vi.fn(), updateTask: vi.fn() }
    const events = { addEvent: vi.fn() }
    const registry = createRegistry()
    const execute = vi.fn(async () => ({ ok: true, output: { type: 'image', status: 'created' } }))
    const calls = normalizeStarChatToolCalls({
      action: {
        type: 'tool_call',
        toolName: 'star.generateImage',
        input: { prompt: '星空' },
        mode: 'propose',
        reason: '需要确认。',
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
      registry: {
        get: registry.get,
        execute,
      },
      policy: { autoRunLowRiskTasks: true } as any,
    })).resolves.toEqual([
      expect.objectContaining({
        toolName: 'star.generateImage',
        status: 'waiting_approval',
        inboxItemId: expect.stringMatching(/^task_approval:/),
      }),
    ])
    expect(tasks.addTask).toHaveBeenCalledWith(expect.objectContaining({ status: 'queued' }))
    expect(tasks.updateTask).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status: 'waiting_approval' }))
    expect(execute).not.toHaveBeenCalled()
  })

  it('runs explicit medium-risk media calls when default policy allows it', async () => {
    const tasks = { addTask: vi.fn(), updateTask: vi.fn() }
    const events = { addEvent: vi.fn() }
    const registry = createRegistry()
    const execute = vi.fn(async () => ({ ok: true, output: { type: 'image', status: 'created' } }))

    await expect(executeStarChatToolCalls({
      agentId: 'agent_1',
      now: '2026-05-19T00:00:00.000Z',
      calls: [{
        toolName: 'star.generateImage',
        input: { prompt: '星空' },
        mode: 'execute',
        reason: '',
        status: 'ready',
      }],
      tasks,
      events,
      registry: {
        get: registry.get,
        execute,
      },
      policy: { autoRunLowRiskTasks: true } as any,
    })).resolves.toEqual([
      expect.objectContaining({
        toolName: 'star.generateImage',
        status: 'completed',
      }),
    ])
    expect(execute).toHaveBeenCalledWith('star.generateImage', { prompt: '星空' })
  })

  it('returns chat parts from completed tool execution without persisting them in task result', async () => {
    const tasks = { addTask: vi.fn(), updateTask: vi.fn() }
    const events = { addEvent: vi.fn() }
    const registry = createRegistry()

    await expect(executeStarChatToolCalls({
      agentId: 'agent_1',
      now: '2026-05-19T00:00:00.000Z',
      calls: [{
        toolName: 'star.generateImage',
        input: { prompt: '星空' },
        mode: 'execute',
        reason: '',
        status: 'ready',
      }],
      tasks,
      events,
      registry: {
        get: registry.get,
        execute: vi.fn(async () => ({
          ok: true,
          output: { type: 'image', status: 'created' },
          chatParts: [{ type: 'image', base64: 'raw-image' }],
        })),
      },
      policy: { autoRunLowRiskTasks: true } as any,
    })).resolves.toEqual([
      expect.objectContaining({
        status: 'completed',
        chatParts: [{ type: 'image', base64: 'raw-image' }],
        result: { type: 'image', status: 'created' },
      }),
    ])

    const completedUpdate = tasks.updateTask.mock.calls.find(call => call[1]?.status === 'completed')?.[1]
    expect(completedUpdate?.resultJson).not.toContain('raw-image')
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
