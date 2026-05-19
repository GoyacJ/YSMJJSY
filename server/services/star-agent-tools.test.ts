import { describe, expect, it, vi } from 'vitest'
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

  it('runs speak reply through the injected reply presenter without returning raw audio data', async () => {
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
    })
    expect(JSON.stringify(result.output)).not.toContain('raw-audio')
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
})
