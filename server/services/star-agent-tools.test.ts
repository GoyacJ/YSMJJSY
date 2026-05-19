import { describe, expect, it, vi } from 'vitest'
import { defaultStarBoundarySettings } from '../db/sqlite'
import { createAgentToolRegistry } from './agent-runtime'
import { registerDefaultStarAgentTools } from './star-agent-runtime'
import { registerStarAgentTools } from './star-agent-tools'

describe('star agent tools', () => {
  it('registers star domain tools with risk metadata', () => {
    const registry = createAgentToolRegistry()

    registerStarAgentTools(registry, {} as any)
    const tools = registry.list()
    const toolByName = (name: string) => tools.find(tool => tool.name === name)

    expect(tools.map(tool => tool.name)).toEqual(expect.arrayContaining([
      'star.previewDesign',
      'star.commitDesign',
      'star.sleep',
      'star.publishWork',
      'star.governMemory',
      'star.generateImage',
      'star.generateMusic',
      'star.generateVideo',
    ]))
    expect(registry.get('star.publishWork')?.approvalRequired).toBe(true)
    expect(toolByName('star.generateImage')).toMatchObject({
      title: '生成图片',
      category: 'media',
      behavior: 'create',
      aliases: expect.arrayContaining(['画一张', '图片']),
      inputSchema: { prompt: 'string' },
    })
    expect(toolByName('star.generateMusic')).toMatchObject({
      title: '生成音乐',
      category: 'media',
      behavior: 'create',
      aliases: expect.arrayContaining(['音乐']),
      inputSchema: { prompt: 'string' },
    })
    expect(toolByName('star.generateVideo')).toMatchObject({
      title: '生成视频',
      category: 'media',
      behavior: 'create',
      aliases: expect.arrayContaining(['视频']),
      inputSchema: { prompt: 'string' },
    })
    expect(toolByName('star.governMemory')).toMatchObject({
      title: '治理记忆',
      category: 'memory',
      behavior: 'mutate',
      inputSchema: { memoryId: 'string', action: 'string', reason: 'string' },
    })
    expect(toolByName('star.publishWork')).toMatchObject({
      title: '发布作品',
      category: 'publish',
      behavior: 'publish',
      inputSchema: { workId: 'string' },
    })
    expect(toolByName('star.previewDesign')).toMatchObject({
      title: '预览设计',
      category: 'design',
      behavior: 'mutate',
      inputSchema: { instruction: 'string' },
    })
    expect(toolByName('star.commitDesign')).toMatchObject({
      title: '提交设计',
      category: 'design',
      behavior: 'mutate',
      inputSchema: { version: 'number' },
    })
    expect(toolByName('star.sleep')).toMatchObject({
      title: '睡眠整理',
      category: 'system',
      behavior: 'mutate',
      aliases: expect.arrayContaining(['整理记忆', '睡眠', '复盘', '沉淀']),
      whenToUse: expect.stringContaining('整理记忆'),
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    })
  })

  it('executes publish work through injected repositories', async () => {
    const registry = createAgentToolRegistry()
    const updateWorkVisibility = vi.fn()

    registerStarAgentTools(registry, {
      keyId: 'key_1',
      now: '2026-05-18T00:00:00.000Z',
      works: {
        getWorkByKey: () => ({ id: 'work_1', visibility: 'private' }),
        updateWorkVisibility,
      },
    } as any)

    await registry.execute('star.publishWork', { workId: 'work_1' })

    expect(updateWorkVisibility).toHaveBeenCalledWith('key_1', 'work_1', 'public', '2026-05-18T00:00:00.000Z')
  })

  it('registers default media tools through the default runtime', async () => {
    const registry = createAgentToolRegistry()

    registerDefaultStarAgentTools(registry, {
      minimaxApiKey: 'key',
      media: {
        generateImage: vi.fn(async () => ({ url: 'image' })),
        generateMusic: vi.fn(async () => ({ url: 'music' })),
        createVideoTask: vi.fn(async () => ({ providerTaskId: 'video' })),
      },
    } as any)

    await expect(registry.execute('star.generateImage', { prompt: 'x' })).resolves.toMatchObject({ ok: true })
  })

  it('runs speak reply through the injected reply presenter and returns base64 only as chat parts', async () => {
    const registry = createAgentToolRegistry()
    const speak = vi.fn(async () => ({ base64: 'raw-audio' }))

    registerStarAgentTools(registry, {
      reply: {
        speak,
      },
    } as any)

    expect(registry.list().find(tool => tool.name === 'star.speakReply')).toMatchObject({
      title: '语音回复',
      category: 'reply',
      behavior: 'present_reply',
      aliases: expect.arrayContaining(['读给我听', '语音回复']),
      inputSchema: { text: 'string' },
      riskLevel: 'low',
      approvalRequired: false,
    })

    const result = await registry.execute('star.speakReply', { text: '你好' })

    expect(speak).toHaveBeenCalledWith('你好')
    expect(result).toMatchObject({
      ok: true,
      output: {
        type: 'audio',
        status: 'created',
      },
      chatParts: [
        { type: 'audio', base64: 'raw-audio' },
      ],
    })
    expect(JSON.stringify(result.output)).not.toContain('raw-audio')
  })

  it('describes music generation as song and music capability', () => {
    const registry = createAgentToolRegistry()

    registerStarAgentTools(registry, {} as any)

    expect(registry.list().find(tool => tool.name === 'star.generateMusic')).toMatchObject({
      capabilities: ['generate_music', 'generate_song'],
      aliases: expect.arrayContaining(['唱首歌', '听一首歌', '想听歌', '制作音乐', '生成音乐']),
      outputTypes: ['music'],
    })
  })

  it('describes speech as text to speech, not singing', () => {
    const registry = createAgentToolRegistry()

    registerStarAgentTools(registry, {} as any)

    expect(registry.list().find(tool => tool.name === 'star.speakReply')).toMatchObject({
      capabilities: ['text_to_speech'],
      aliases: expect.arrayContaining(['读给我听', '念给我听']),
      cannotDo: expect.stringContaining('不是唱歌工具'),
      outputTypes: ['audio'],
    })
  })

  it('keeps speak reply url in persistent output and chat parts', async () => {
    const registry = createAgentToolRegistry()
    const speak = vi.fn(async () => ({ url: 'https://example.com/reply.mp3' }))

    registerStarAgentTools(registry, {
      reply: {
        speak,
      },
    } as any)

    await expect(registry.execute('star.speakReply', { text: '你好' })).resolves.toMatchObject({
      ok: true,
      output: {
        type: 'audio',
        status: 'created',
        url: 'https://example.com/reply.mp3',
      },
      chatParts: [
        { type: 'audio', url: 'https://example.com/reply.mp3' },
      ],
    })
  })

  it('searches memory summaries without exposing private fields', async () => {
    const registry = createAgentToolRegistry()

    registerStarAgentTools(registry, {
      keyId: 'key_1',
      memorySearch: {
        search: vi.fn(() => [
          {
            id: 'memory_1',
            content: '用户喜欢短句。',
            status: 'active',
            keyId: 'key_1',
            payloadJson: '{"secret":true}',
          },
        ]),
      },
    } as any)

    const result = await registry.execute('star.searchMemories', { query: '短句', limit: 3 })

    expect(result).toEqual({
      ok: true,
      output: {
        memories: [
          {
            id: 'memory_1',
            content: '用户喜欢短句。',
            status: 'active',
          },
        ],
      },
    })
    expect(JSON.stringify(result.output)).not.toContain('key_1')
    expect(JSON.stringify(result.output)).not.toContain('payloadJson')
  })

  it('searches work summaries without exposing raw payloads or media data', async () => {
    const registry = createAgentToolRegistry()

    registerStarAgentTools(registry, {
      keyId: 'key_1',
      workSearch: {
        search: vi.fn(() => [
          {
            id: 'work_1',
            type: 'image',
            title: '月光星空',
            summary: '一张星空图。',
            keyId: 'key_1',
            payloadJson: '{"base64":"raw"}',
            previewUrl: 'data:image/png;base64,raw',
          },
        ]),
      },
    } as any)

    const result = await registry.execute('star.searchWorks', { query: '星空', limit: 3 })

    expect(result).toEqual({
      ok: true,
      output: {
        works: [
          {
            id: 'work_1',
            type: 'image',
            title: '月光星空',
            summary: '一张星空图。',
          },
        ],
      },
    })
    expect(JSON.stringify(result.output)).not.toContain('key_1')
    expect(JSON.stringify(result.output)).not.toContain('payloadJson')
    expect(JSON.stringify(result.output)).not.toContain('data:image')
    expect(JSON.stringify(result.output)).not.toContain('raw')
  })

  it('runs sleep through the registered star sleep tool', async () => {
    const registry = createAgentToolRegistry()
    const sleep = vi.fn(async () => ({ run: { id: 'sleep_1', status: 'completed' } }))

    registerStarAgentTools(registry, { sleep } as any)

    await expect(registry.execute('star.sleep', {})).resolves.toMatchObject({
      ok: true,
      output: { run: { id: 'sleep_1', status: 'completed' } },
    })
    expect(sleep).toHaveBeenCalled()
  })

  it('persists generated image task output as a private work without returning raw base64', async () => {
    const registry = createAgentToolRegistry()
    const addWork = vi.fn()

    registerStarAgentTools(registry, {
      keyId: 'key_1',
      now: '2026-05-18T00:00:00.000Z',
      media: {
        generateImage: vi.fn(async () => ({ base64: 'raw-image' })),
      },
      works: {
        addWork,
      },
    } as any)

    const result = await registry.execute('star.generateImage', { prompt: '月光星空' })

    expect(result).toMatchObject({
      ok: true,
      output: {
        workId: expect.any(String),
        type: 'image',
        status: 'created',
      },
      chatParts: [
        { type: 'image', base64: 'raw-image' },
      ],
    })
    expect(JSON.stringify(result.output)).not.toContain('raw-image')
    expect(addWork).toHaveBeenCalledWith(expect.objectContaining({
      keyId: 'key_1',
      type: 'image',
      visibility: 'private',
      summary: '月光星空',
      previewUrl: null,
    }))
    expect(JSON.stringify(addWork.mock.calls[0][0])).not.toContain('raw-image')
    expect(JSON.parse(addWork.mock.calls[0][0].payloadJson)).toMatchObject({
      type: 'image',
      disclosure: {
        aiGenerated: true,
        explicitLabel: 'AI 生成',
        generatedAt: '2026-05-18T00:00:00.000Z',
      },
    })
  })

  it('returns music generation as a non-blocking processing chat part', async () => {
    const registry = createAgentToolRegistry()
    const generateMusic = vi.fn(() => new Promise(() => {}))
    const addMediaTask = vi.fn()

    registerStarAgentTools(registry, {
      keyId: 'key_1',
      now: '2026-05-18T00:00:00.000Z',
      media: {
        generateMusic,
      },
      mediaTasks: {
        addMediaTask,
        updateMediaTask: vi.fn(),
      },
    } as any)

    const result = await registry.execute('star.generateMusic', { prompt: '星空歌' })

    expect(generateMusic).toHaveBeenCalledWith('星空歌')
    expect(addMediaTask).toHaveBeenCalledWith(expect.objectContaining({
      keyId: 'key_1',
      type: 'music',
      status: 'processing',
      prompt: '星空歌',
    }))
    expect(result).toMatchObject({
      ok: true,
      output: {
        type: 'music',
        status: 'processing',
        taskId: expect.any(String),
      },
      chatParts: [
        { type: 'music', status: 'processing', taskId: expect.any(String) },
      ],
    })
  })

  it('returns generated video provider task id to chat parts', async () => {
    const registry = createAgentToolRegistry()

    registerStarAgentTools(registry, {
      media: {
        createVideoTask: vi.fn(async () => ({ providerTaskId: 'provider-task-1' })),
      },
    } as any)

    await expect(registry.execute('star.generateVideo', { prompt: '星空视频' })).resolves.toMatchObject({
      ok: true,
      output: {
        type: 'video',
        status: 'processing',
        providerTaskId: 'provider-task-1',
      },
      chatParts: [
        { type: 'video', providerTaskId: 'provider-task-1' },
      ],
    })
  })

  it('keeps generated works private even when boundary settings contain public visibility', async () => {
    const registry = createAgentToolRegistry()
    const addWork = vi.fn()

    registerStarAgentTools(registry, {
      keyId: 'key_1',
      now: '2026-05-18T00:00:00.000Z',
      boundarySettings: {
        ...defaultStarBoundarySettings,
        generatedWorksDefaultVisibility: 'public',
      },
      media: {
        generateImage: vi.fn(async () => ({ url: 'image' })),
      },
      works: {
        addWork,
      },
    } as any)

    await registry.execute('star.generateImage', { prompt: '月光星空' })

    expect(addWork).toHaveBeenCalledWith(expect.objectContaining({
      visibility: 'private',
    }))
  })

  it('does not claim a memory was deleted when delete repository support is missing', async () => {
    const registry = createAgentToolRegistry()
    const addMemoryEvent = vi.fn()

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
        updateMemory: vi.fn(),
      },
      memoryEvents: { addMemoryEvent },
    } as any)

    await expect(registry.execute('star.governMemory', {
      memoryId: 'memory_1',
      action: 'delete',
      reason: '用户要求删除。',
    })).resolves.toMatchObject({
      ok: false,
      error: expect.any(String),
    })
    expect(addMemoryEvent).not.toHaveBeenCalled()
  })
})
