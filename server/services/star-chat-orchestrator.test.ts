import { describe, expect, it, vi } from 'vitest'
import { createAgentToolRegistry } from './agent-runtime'
import { runStarChatToolOrchestrator } from './star-chat-orchestrator'

function createMediaRegistry() {
  const registry = createAgentToolRegistry()

  registry.register({
    name: 'star.generateImage',
    title: '生成图片',
    description: 'Generate image.',
    category: 'media',
    behavior: 'create',
    capabilities: ['generate_image'],
    outputTypes: ['image'],
    inputSchema: { prompt: 'string' },
    riskLevel: 'medium',
    approvalRequired: false,
    execute: vi.fn(async () => ({
      ok: true,
      output: { type: 'image', status: 'created' },
      chatParts: [{ type: 'image', url: 'https://example.com/sunset.png' }],
    })),
  })

  registry.register({
    name: 'star.generateMusic',
    title: '生成音乐',
    description: 'Generate music.',
    category: 'media',
    behavior: 'create',
    capabilities: ['generate_music', 'generate_song'],
    aliases: ['音乐'],
    outputTypes: ['music'],
    inputSchema: { prompt: 'string' },
    riskLevel: 'medium',
    approvalRequired: false,
    execute: vi.fn(async () => ({
      ok: true,
      output: { type: 'music', status: 'created' },
      chatParts: [{ type: 'music', url: 'https://example.com/song.mp3' }],
    })),
  })

  return registry
}

function createRepositories() {
  return {
    tasks: { addTask: vi.fn(), updateTask: vi.fn() },
    events: { addEvent: vi.fn() },
  }
}

describe('star chat tool orchestrator', () => {
  it('emits a visible planning status before waiting for model action', async () => {
    let resolvePlanner!: (value: { reply: string }) => void
    const plannerGate = new Promise<{ reply: string }>((resolve) => {
      resolvePlanner = resolve
    })
    const provider = {
      chat: vi.fn(() => plannerGate),
    }
    const emitted: any[] = []
    const repositories = createRepositories()
    const run = runStarChatToolOrchestrator({
      prompt: '我想听一首歌',
      baseMessages: [{ role: 'user', content: '我想听一首歌' }],
      provider: provider as never,
      registry: createMediaRegistry(),
      commonToolNames: ['star.generateMusic'],
      agentId: 'agent_1',
      now: '2026-05-19T00:00:00.000Z',
      tasks: repositories.tasks,
      events: repositories.events,
      policy: { autoRunLowRiskTasks: true } as any,
      emit: event => emitted.push(event),
    })

    await Promise.resolve()

    expect(emitted[0]).toEqual({ type: 'tool-status', text: '正在分析可用工具。', visibility: 'user' })

    resolvePlanner({ reply: JSON.stringify({ type: 'answer', reply: '收到。' }) })
    await run
  })

  it('treats non-json model text as a normal answer when no tool capability is requested', async () => {
    const provider = {
      chat: vi.fn(async () => ({ reply: '你好。' })),
    }
    const repositories = createRepositories()
    const emitted: any[] = []

    const result = await runStarChatToolOrchestrator({
      prompt: '你好',
      baseMessages: [{ role: 'user', content: '你好' }],
      provider: provider as never,
      registry: createMediaRegistry(),
      commonToolNames: ['star.generateImage', 'star.generateMusic'],
      agentId: 'agent_1',
      now: '2026-05-19T00:00:00.000Z',
      tasks: repositories.tasks,
      events: repositories.events,
      policy: { autoRunLowRiskTasks: true } as any,
      emit: event => emitted.push(event),
    })

    expect(result.reply).toBe('你好。')
    expect(emitted.at(-1)).toMatchObject({
      type: 'message',
      reply: '你好。',
    })
  })

  it('rejects tool calls that are not grounded in the current user turn', async () => {
    const provider = {
      chat: vi.fn()
        .mockResolvedValueOnce({ reply: JSON.stringify({
          type: 'tool_call',
          toolName: 'star.generateMusic',
          input: { prompt: '温柔的歌' },
          mode: 'execute',
          reason: '用户以前说过想听歌。',
        }) })
        .mockResolvedValueOnce({ reply: JSON.stringify({ type: 'answer', reply: '你好。' }) }),
    }
    const repositories = createRepositories()

    const result = await runStarChatToolOrchestrator({
      prompt: '你好',
      baseMessages: [
        { role: 'system', content: '星信人设。' },
        { role: 'user', content: '你好' },
      ],
      provider: provider as never,
      registry: createMediaRegistry(),
      commonToolNames: ['star.generateImage', 'star.generateMusic'],
      agentId: 'agent_1',
      now: '2026-05-19T00:00:00.000Z',
      tasks: repositories.tasks,
      events: repositories.events,
      policy: { autoRunLowRiskTasks: true } as any,
      emit: vi.fn(),
    })

    expect(provider.chat).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(provider.chat.mock.calls[1][0])).toContain('Tool call is not grounded in the current user turn')
    expect(repositories.tasks.addTask).not.toHaveBeenCalled()
    expect(result.reply).toBe('你好。')
  })

  it('executes image tools and returns media parts', async () => {
    const provider = {
      chat: vi.fn()
        .mockResolvedValueOnce({ reply: JSON.stringify({
          type: 'tool_call',
          toolName: 'star.generateImage',
          input: { prompt: '夕阳' },
          mode: 'execute',
          reason: '用户要求画一张夕阳。',
        }) })
        .mockResolvedValueOnce({ reply: JSON.stringify({ type: 'answer', reply: '画好了。' }) }),
    }
    const emitted: any[] = []
    const repositories = createRepositories()

    await expect(runStarChatToolOrchestrator({
      prompt: '我想看夕阳，给我画一张',
      baseMessages: [{ role: 'user', content: '我想看夕阳，给我画一张' }],
      provider: provider as never,
      registry: createMediaRegistry(),
      commonToolNames: ['star.generateImage'],
      agentId: 'agent_1',
      now: '2026-05-19T00:00:00.000Z',
      tasks: repositories.tasks,
      events: repositories.events,
      policy: { autoRunLowRiskTasks: true } as any,
      emit: event => emitted.push(event),
    })).resolves.toMatchObject({
      reply: '画好了。',
      message: {
        content: '画好了。',
        parts: [
          { type: 'text', text: '画好了。' },
          { type: 'image', url: 'https://example.com/sunset.png' },
        ],
      },
    })
    expect(provider.chat).toHaveBeenCalledTimes(2)
    expect(emitted.map(event => event.type)).toContain('tool-status')
    expect(emitted).toContainEqual({ type: 'tool-status', text: '用户要求画一张夕阳。', visibility: 'user' })
    expect(emitted.at(-1)).toMatchObject({ type: 'message' })
  })

  it('retries proposed media creation and executes it without confirmation when policy allows direct run', async () => {
    const provider = {
      chat: vi.fn()
        .mockResolvedValueOnce({ reply: JSON.stringify({
          type: 'tool_call',
          toolName: 'star.generateMusic',
          input: { prompt: '温柔的歌' },
          mode: 'propose',
          reason: '用户想听歌。',
        }) })
        .mockResolvedValueOnce({ reply: JSON.stringify({
          type: 'tool_call',
          toolName: 'star.generateMusic',
          input: { prompt: '温柔的歌' },
          mode: 'execute',
          reason: '用户想听歌。',
        }) })
        .mockResolvedValueOnce({ reply: JSON.stringify({ type: 'answer', reply: '音乐生成已开始。' }) }),
    }
    const emitted: any[] = []
    const repositories = createRepositories()
    const registry = createMediaRegistry()

    const result = await runStarChatToolOrchestrator({
      prompt: '你可以给我唱首歌吗',
      baseMessages: [{ role: 'user', content: '你可以给我唱首歌吗' }],
      provider: provider as never,
      registry,
      commonToolNames: ['star.generateMusic'],
      agentId: 'agent_1',
      now: '2026-05-19T00:00:00.000Z',
      tasks: repositories.tasks,
      events: repositories.events,
      policy: { autoRunLowRiskTasks: true } as any,
      emit: event => emitted.push(event),
    })

    expect(provider.chat).toHaveBeenCalledTimes(3)
    expect(JSON.stringify(provider.chat.mock.calls[1][0])).toContain('Tool does not require approval; use execute mode.')
    expect(emitted).not.toContainEqual(expect.objectContaining({ type: 'tool-confirmation' }))
    expect(result.message.parts).toContainEqual({ type: 'music', url: 'https://example.com/song.mp3' })
    expect(registry.get('star.generateMusic')?.execute).toHaveBeenCalledTimes(1)
  })

  it('does not expose raw tool errors as user visible status', async () => {
    const provider = {
      chat: vi.fn()
        .mockResolvedValueOnce({ reply: JSON.stringify({
          type: 'tool_call',
          toolName: 'star.generateMusic',
          input: { prompt: '温柔的歌' },
          mode: 'execute',
          reason: '用户想听歌。',
        }) })
        .mockResolvedValueOnce({ reply: JSON.stringify({ type: 'answer', reply: '音乐生成没有提交成功。' }) }),
    }
    const emitted: any[] = []
    const repositories = createRepositories()
    const registry = createMediaRegistry()

    vi.mocked(registry.get('star.generateMusic')?.execute as any).mockResolvedValue({
      ok: false,
      error: 'The operation was aborted due to timeout',
    })

    await runStarChatToolOrchestrator({
      prompt: '我要听歌',
      baseMessages: [{ role: 'user', content: '我要听歌' }],
      provider: provider as never,
      registry,
      commonToolNames: ['star.generateMusic'],
      agentId: 'agent_1',
      now: '2026-05-19T00:00:00.000Z',
      tasks: repositories.tasks,
      events: repositories.events,
      policy: { autoRunLowRiskTasks: true } as any,
      emit: event => emitted.push(event),
    })

    expect(emitted).toContainEqual({
      type: 'tool-status',
      text: 'The operation was aborted due to timeout',
      visibility: 'debug',
    })
    expect(emitted.filter(event => event.visibility !== 'debug')).not.toContainEqual(
      expect.objectContaining({ text: 'The operation was aborted due to timeout' }),
    )
  })

  it('uses tool search before calling tools that are not common', async () => {
    const provider = {
      chat: vi.fn()
        .mockResolvedValueOnce({ reply: JSON.stringify({ type: 'tool_search', query: '音乐', category: 'media', behavior: 'create' }) })
        .mockResolvedValueOnce({ reply: JSON.stringify({
          type: 'tool_call',
          toolName: 'star.generateMusic',
          input: { prompt: '温柔的歌' },
          mode: 'execute',
          reason: '用户想听歌。',
        }) })
        .mockResolvedValueOnce({ reply: JSON.stringify({ type: 'answer', reply: '音乐做好了。' }) }),
    }
    const repositories = createRepositories()

    const result = await runStarChatToolOrchestrator({
      prompt: '我要听歌',
      baseMessages: [{ role: 'user', content: '我要听歌' }],
      provider: provider as never,
      registry: createMediaRegistry(),
      commonToolNames: ['star.generateImage'],
      agentId: 'agent_1',
      now: '2026-05-19T00:00:00.000Z',
      tasks: repositories.tasks,
      events: repositories.events,
      policy: { autoRunLowRiskTasks: true } as any,
      emit: vi.fn(),
    })

    expect(provider.chat).toHaveBeenCalledTimes(3)
    expect(JSON.stringify(provider.chat.mock.calls[1][0])).toContain('star.generateMusic')
    expect(result.message.parts).toContainEqual({ type: 'music', url: 'https://example.com/song.mp3' })
  })

  it('exposes recent tools without requiring a new search', async () => {
    const provider = {
      chat: vi.fn()
        .mockResolvedValueOnce({ reply: JSON.stringify({
          type: 'tool_call',
          toolName: 'star.generateMusic',
          input: { prompt: '温柔的歌' },
          mode: 'execute',
          reason: '用户想继续使用最近的音乐工具。',
        }) })
        .mockResolvedValueOnce({ reply: JSON.stringify({ type: 'answer', reply: '音乐做好了。' }) }),
    }
    const repositories = createRepositories()

    const result = await runStarChatToolOrchestrator({
      prompt: '再来一首',
      baseMessages: [{ role: 'user', content: '再来一首' }],
      provider: provider as never,
      registry: createMediaRegistry(),
      commonToolNames: ['star.generateImage'],
      recentToolNames: ['star.generateMusic'],
      agentId: 'agent_1',
      now: '2026-05-19T00:00:00.000Z',
      tasks: repositories.tasks,
      events: repositories.events,
      policy: { autoRunLowRiskTasks: true } as any,
      emit: vi.fn(),
    })

    expect(provider.chat).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(provider.chat.mock.calls[0][0])).toContain('recentTools')
    expect(result.message.parts).toContainEqual({ type: 'music', url: 'https://example.com/song.mp3' })
  })

  it('retries invalid capability denial and does not fallback to normal chat', async () => {
    const provider = {
      chat: vi.fn()
        .mockResolvedValueOnce({ reply: JSON.stringify({
          type: 'unavailable',
          reply: '我不能画画。',
          searched: false,
          reason: '模型自我限制。',
        }) })
        .mockResolvedValueOnce({ reply: JSON.stringify({
          type: 'tool_call',
          toolName: 'star.generateImage',
          input: { prompt: '夕阳' },
          mode: 'execute',
          reason: '用户要求画图。',
        }) })
        .mockResolvedValueOnce({ reply: JSON.stringify({ type: 'answer', reply: '画好了。' }) }),
    }
    const repositories = createRepositories()

    const result = await runStarChatToolOrchestrator({
      prompt: '给我画一张夕阳',
      baseMessages: [{ role: 'user', content: '给我画一张夕阳' }],
      provider: provider as never,
      registry: createMediaRegistry(),
      commonToolNames: ['star.generateImage'],
      agentId: 'agent_1',
      now: '2026-05-19T00:00:00.000Z',
      tasks: repositories.tasks,
      events: repositories.events,
      policy: { autoRunLowRiskTasks: true } as any,
      emit: vi.fn(),
    })

    expect(provider.chat).toHaveBeenCalledTimes(3)
    expect(JSON.stringify(provider.chat.mock.calls[1][0])).toContain('Action denies an available tool capability')
    expect(result.reply).toBe('画好了。')
    expect(result.reply).not.toContain('不能')
  })

  it('executes multiple tools sequentially and returns all media parts', async () => {
    const provider = {
      chat: vi.fn()
        .mockResolvedValueOnce({ reply: JSON.stringify({
          type: 'tool_call',
          toolName: 'star.generateMusic',
          input: { prompt: '温柔的歌' },
          mode: 'execute',
          reason: '先生成音乐。',
        }) })
        .mockResolvedValueOnce({ reply: JSON.stringify({
          type: 'tool_call',
          toolName: 'star.generateImage',
          input: { prompt: '歌曲封面' },
          mode: 'execute',
          reason: '再生成封面。',
        }) })
        .mockResolvedValueOnce({ reply: JSON.stringify({ type: 'answer', reply: '歌和封面都做好了。' }) }),
    }
    const repositories = createRepositories()

    const result = await runStarChatToolOrchestrator({
      prompt: '做一首歌，再配一张封面',
      baseMessages: [{ role: 'user', content: '做一首歌，再配一张封面' }],
      provider: provider as never,
      registry: createMediaRegistry(),
      commonToolNames: ['star.generateImage', 'star.generateMusic'],
      agentId: 'agent_1',
      now: '2026-05-19T00:00:00.000Z',
      tasks: repositories.tasks,
      events: repositories.events,
      policy: { autoRunLowRiskTasks: true } as any,
      emit: vi.fn(),
    })

    expect(result.message.parts).toEqual(expect.arrayContaining([
      { type: 'music', url: 'https://example.com/song.mp3' },
      { type: 'image', url: 'https://example.com/sunset.png' },
    ]))
  })

  it('does not let a failure reply override completed media results', async () => {
    const provider = {
      chat: vi.fn()
        .mockResolvedValueOnce({ reply: JSON.stringify({
          type: 'tool_call',
          toolName: 'star.generateMusic',
          input: { prompt: '温柔的歌' },
          mode: 'execute',
          reason: '用户想听歌。',
        }) })
        .mockResolvedValueOnce({ reply: JSON.stringify({ type: 'answer', reply: '工具规划失败，请重试。' }) })
        .mockResolvedValueOnce({ reply: JSON.stringify({ type: 'answer', reply: '音乐做好了。' }) }),
    }
    const emitted: any[] = []
    const repositories = createRepositories()
    const registry = createMediaRegistry()

    const result = await runStarChatToolOrchestrator({
      prompt: '我要听歌',
      baseMessages: [{ role: 'user', content: '我要听歌' }],
      provider: provider as never,
      registry,
      commonToolNames: ['star.generateMusic'],
      agentId: 'agent_1',
      now: '2026-05-19T00:00:00.000Z',
      tasks: repositories.tasks,
      events: repositories.events,
      policy: { autoRunLowRiskTasks: true } as any,
      emit: event => emitted.push(event),
    })

    expect(provider.chat).toHaveBeenCalledTimes(3)
    expect(JSON.stringify(provider.chat.mock.calls[2][0])).toContain('Action reply conflicts with completed tool results')
    expect(result.reply).toBe('音乐做好了。')
    expect(result.reply).not.toContain('工具规划失败')
    expect(result.message.parts).toContainEqual({ type: 'music', url: 'https://example.com/song.mp3' })
    expect(emitted).not.toContainEqual(expect.objectContaining({ type: 'delta', text: '工具规划失败，请重试。' }))
  })

  it('recovers with completed media when the model repeats the same tool call', async () => {
    const repeatedCall = {
      type: 'tool_call',
      toolName: 'star.generateMusic',
      input: { prompt: '温柔的歌' },
      mode: 'execute',
      reason: '用户想听歌。',
    }
    const provider = {
      chat: vi.fn()
        .mockResolvedValueOnce({ reply: JSON.stringify(repeatedCall) })
        .mockResolvedValueOnce({ reply: JSON.stringify(repeatedCall) })
        .mockResolvedValueOnce({ reply: JSON.stringify(repeatedCall) })
        .mockResolvedValueOnce({ reply: JSON.stringify(repeatedCall) }),
    }
    const repositories = createRepositories()
    const registry = createMediaRegistry()

    const result = await runStarChatToolOrchestrator({
      prompt: '我要听歌',
      baseMessages: [{ role: 'user', content: '我要听歌' }],
      provider: provider as never,
      registry,
      commonToolNames: ['star.generateMusic'],
      agentId: 'agent_1',
      now: '2026-05-19T00:00:00.000Z',
      tasks: repositories.tasks,
      events: repositories.events,
      policy: { autoRunLowRiskTasks: true } as any,
      emit: vi.fn(),
    })

    expect(result.reply).toBe('音乐做好了。')
    expect(result.message.parts).toContainEqual({ type: 'music', url: 'https://example.com/song.mp3' })
    expect(repositories.tasks.addTask).toHaveBeenCalledTimes(1)
    expect(registry.get('star.generateMusic')?.execute).toHaveBeenCalledTimes(1)
  })
})
