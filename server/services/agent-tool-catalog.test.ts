import { describe, expect, it, vi } from 'vitest'
import type { AgentToolDefinition } from './agent-runtime'
import { searchAgentTools } from './agent-tool-catalog'

const tools: AgentToolDefinition[] = [
  {
    name: 'star.generateImage',
    title: '生成图片',
    description: 'Generate an image artifact.',
    category: 'media',
    behavior: 'create',
    aliases: ['画一张', '图片', '插画'],
    whenToUse: '用户明确要求生成静态画面。',
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
    aliases: ['音乐', '写首歌'],
    whenToUse: '用户明确要求生成音乐。',
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
    aliases: ['视频'],
    whenToUse: '用户明确要求生成视频。',
    inputSchema: { prompt: 'string' },
    riskLevel: 'medium',
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
    expect(searchAgentTools({ tools, query: '生成', category: 'media' }).map(tool => tool.name)).toEqual([
      'star.generateImage',
      'star.generateMusic',
      'star.generateVideo',
    ])
  })

  it('filters by behavior', () => {
    expect(searchAgentTools({ tools, query: '作品', behavior: 'publish' }).map(tool => tool.name)).toEqual([
      'star.publishWork',
    ])
  })

  it('defaults to five results', () => {
    expect(searchAgentTools({ tools, query: '' })).toHaveLength(5)
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
})
