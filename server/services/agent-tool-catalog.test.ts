import { describe, expect, it, vi } from 'vitest'
import type { AgentToolDefinition } from './agent-runtime'
import { createAgentToolRegistry } from './agent-runtime'
import { buildChatToolCandidates, searchAgentTools } from './agent-tool-catalog'
import { registerStarAgentTools } from './star-agent-tools'

const tools: AgentToolDefinition[] = [
  {
    name: 'star.generateImage',
    title: '生成图片',
    description: 'Generate an image artifact.',
    category: 'media',
    behavior: 'create',
    capabilities: ['generate_image'],
    aliases: ['画一张', '图片', '插画'],
    whenToUse: '用户明确要求生成静态画面。',
    outputTypes: ['image'],
    inputSchema: { prompt: 'string' },
    riskLevel: 'medium',
    approvalRequired: false,
  },
  {
    name: 'star.searchMemories',
    title: '搜索记忆',
    description: 'Search memory summaries.',
    category: 'memory',
    behavior: 'retrieve',
    aliases: ['查记忆', '回忆'],
    whenToUse: '用户需要查找过往记忆。',
    inputSchema: { query: 'string' },
    riskLevel: 'low',
    approvalRequired: false,
  },
  {
    name: 'star.publishWork',
    title: '发布作品',
    description: 'Publish a saved work.',
    category: 'publish',
    behavior: 'publish',
    aliases: ['发布', '公开'],
    whenToUse: '用户明确要求发布已有作品。',
    inputSchema: { workId: 'string' },
    riskLevel: 'high',
    approvalRequired: true,
  },
  {
    name: 'star.generateMusic',
    title: '生成音乐',
    description: 'Generate a music artifact.',
    category: 'media',
    behavior: 'create',
    capabilities: ['generate_music', 'generate_song'],
    aliases: ['音乐', '写首歌', '唱首歌', '听一首歌', '想听歌', '制作音乐', '生成音乐'],
    whenToUse: '用户明确要求生成音乐。',
    outputTypes: ['music'],
    inputSchema: { prompt: 'string' },
    riskLevel: 'medium',
    approvalRequired: false,
  },
  {
    name: 'star.generateVideo',
    title: '生成视频',
    description: 'Generate a video artifact.',
    category: 'media',
    behavior: 'create',
    capabilities: ['generate_video'],
    aliases: ['视频'],
    whenToUse: '用户明确要求生成视频。',
    outputTypes: ['video'],
    inputSchema: { prompt: 'string' },
    riskLevel: 'medium',
    approvalRequired: false,
  },
  {
    name: 'star.speakReply',
    title: '语音回复',
    description: 'Present the current reply as speech.',
    category: 'reply',
    behavior: 'present_reply',
    capabilities: ['text_to_speech'],
    aliases: ['读给我听', '念给我听'],
    whenToUse: '用户明确要求把本轮回复读出来或用语音回复。',
    cannotDo: '不是唱歌工具，不生成歌曲或配乐。',
    outputTypes: ['audio'],
    inputSchema: { text: 'string' },
    riskLevel: 'low',
    approvalRequired: false,
  },
  {
    name: 'star.previewDesign',
    title: '预览设计',
    description: 'Preview a design patch.',
    category: 'design',
    behavior: 'mutate',
    aliases: ['改页面'],
    whenToUse: '用户要求预览页面设计变更。',
    inputSchema: { instruction: 'string' },
    riskLevel: 'medium',
    approvalRequired: false,
  },
]

describe('agent tool catalog search', () => {
  it('returns a matching tool by alias', () => {
    expect(searchAgentTools({ tools, query: '画一张' })[0]?.name).toBe('star.generateImage')
  })

  it('filters by category', () => {
    const names = searchAgentTools({ tools, query: '生成', category: 'media' }).map(tool => tool.name)

    expect(names).toHaveLength(3)
    expect(names).toEqual(expect.arrayContaining([
      'star.generateImage',
      'star.generateMusic',
      'star.generateVideo',
    ]))
  })

  it('filters by behavior', () => {
    expect(searchAgentTools({ tools, query: '作品', behavior: 'publish' }).map(tool => tool.name)).toEqual([
      'star.publishWork',
    ])
  })

  it('does not return tools when the query has no matching signal', () => {
    expect(searchAgentTools({ tools, query: '' })).toEqual([])
    expect(searchAgentTools({ tools, query: '今天吃什么' })).toEqual([])
  })

  it('does not include executable functions in results', () => {
    const result = searchAgentTools({
      tools: [
        {
          ...tools[0],
          execute: vi.fn(),
        } as AgentToolDefinition,
      ],
      query: '图片',
    })[0]

    expect(result).not.toHaveProperty('execute')
  })

  it('finds the sleep consolidation tool through system memory terms', () => {
    const registry = createAgentToolRegistry()

    registerStarAgentTools(registry, {} as any)

    expect(searchAgentTools({
      tools: registry.list(),
      query: '复盘记忆',
      category: 'system',
      behavior: 'mutate',
    })[0]).toMatchObject({
      name: 'star.sleep',
      title: '睡眠整理',
      category: 'system',
      behavior: 'mutate',
      whenToUse: expect.stringContaining('整理记忆'),
    })
  })

  it('finds music generation from singing language', () => {
    const results = searchAgentTools({
      tools: [
        tools.find(tool => tool.name === 'star.generateMusic')!,
        tools.find(tool => tool.name === 'star.speakReply')!,
      ],
      query: '唱首歌给我听',
      category: 'media',
      behavior: 'create',
    })

    expect(results[0].name).toBe('star.generateMusic')
  })

  it('finds speech from read-aloud language', () => {
    const results = searchAgentTools({
      tools: [
        tools.find(tool => tool.name === 'star.generateMusic')!,
        tools.find(tool => tool.name === 'star.speakReply')!,
      ],
      query: '把这句话读给我听',
    })

    expect(results[0].name).toBe('star.speakReply')
  })

  it('finds tools by controlled capability tokens', () => {
    const results = searchAgentTools({
      tools,
      query: 'generate_song',
      category: 'media',
      behavior: 'create',
    })

    expect(results[0]).toMatchObject({
      name: 'star.generateMusic',
      capabilities: ['generate_music', 'generate_song'],
      outputTypes: ['music'],
    })
  })

  it('builds chat tool candidates from common tools and message search', () => {
    const candidates = buildChatToolCandidates({
      tools,
      message: '制作一个音乐',
      attachmentKinds: [],
      recentToolNames: [],
      commonToolNames: ['star.speakReply', 'star.generateImage', 'star.generateMusic', 'star.generateVideo'],
      retrievedLimit: 6,
    })

    expect(candidates.commonTools.map(tool => tool.name)).toContain('star.generateMusic')
    expect(candidates.retrievedTools[0].name).toBe('star.generateMusic')
  })

  it('keeps common tools compact and leaves the rest to retrieval', () => {
    const candidates = buildChatToolCandidates({
      tools,
      message: '查记忆',
      attachmentKinds: [],
      recentToolNames: ['star.publishWork'],
      commonToolNames: [
        'star.speakReply',
        'star.generateImage',
        'star.generateMusic',
        'star.generateVideo',
        'star.searchMemories',
      ],
      retrievedLimit: 6,
    })

    expect(candidates.commonTools.map(tool => tool.name)).toEqual([
      'star.speakReply',
      'star.generateImage',
      'star.generateMusic',
      'star.generateVideo',
    ])
    expect(candidates.recentTools.map(tool => tool.name)).toEqual(['star.publishWork'])
    expect(candidates.retrievedTools.map(tool => tool.name)).toContain('star.searchMemories')
  })

  it.each([
    ['唱首歌给我听', 'star.generateMusic'],
    ['我想听一首歌', 'star.generateMusic'],
    ['我要听歌', 'star.generateMusic'],
    ['我想听点什么', 'star.generateMusic'],
    ['制作一个音乐', 'star.generateMusic'],
    ['读给我听', 'star.speakReply'],
    ['生成一张图片', 'star.generateImage'],
    ['做个视频', 'star.generateVideo'],
  ])('orders "%s" before unrelated tools', (query, expectedToolName) => {
    expect(searchAgentTools({
      tools,
      query,
      limit: 3,
    })[0].name).toBe(expectedToolName)
  })
})
