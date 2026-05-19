import { describe, expect, it } from 'vitest'
import type { AgentToolDefinition } from './agent-runtime'
import { buildStarChatActionMessages, parseStarChatAction, validateStarChatAction } from './star-chat-planner'

const toolCards: AgentToolDefinition[] = [
  {
    name: 'star.generateImage',
    title: '生成图片',
    description: 'Generate an image artifact.',
    category: 'media',
    behavior: 'create',
    capabilities: ['generate_image'],
    aliases: ['图片'],
    whenToUse: '用户明确要求生成静态画面。',
    outputTypes: ['image'],
    inputSchema: { prompt: 'string' },
    riskLevel: 'medium',
    approvalRequired: false,
  },
  {
    name: 'star.generateMusic',
    title: '生成音乐',
    description: 'Generate music.',
    category: 'media',
    behavior: 'create',
    capabilities: ['generate_music', 'generate_song'],
    aliases: ['音乐'],
    whenToUse: '用户想听歌、生成音乐、制作配乐、创作歌曲时使用。',
    outputTypes: ['music'],
    inputSchema: { prompt: 'string' },
    riskLevel: 'medium',
    approvalRequired: false,
  },
]

describe('star chat action planner', () => {
  it('parses answer actions', () => {
    expect(parseStarChatAction('{"type":"answer","reply":"你好"}')).toEqual({
      valid: true,
      action: { type: 'answer', reply: '你好' },
    })
  })

  it('parses markdown wrapped tool search actions', () => {
    expect(parseStarChatAction('```json\n{"type":"tool_search","query":"整理记忆","category":"system","limit":3}\n```')).toEqual({
      valid: true,
      action: { type: 'tool_search', query: '整理记忆', category: 'system', limit: 3 },
    })
  })

  it('parses tool call actions', () => {
    expect(parseStarChatAction(JSON.stringify({
      type: 'tool_call',
      toolName: 'star.generateImage',
      input: { prompt: '夕阳' },
      mode: 'execute',
      reason: '用户要求画一张夕阳。',
    }))).toEqual({
      valid: true,
      action: {
        type: 'tool_call',
        toolName: 'star.generateImage',
        input: { prompt: '夕阳' },
        mode: 'execute',
        reason: '用户要求画一张夕阳。',
      },
    })
  })

  it('returns invalid for non JSON and missing fields', () => {
    expect(parseStarChatAction('not json')).toMatchObject({ valid: false })
    expect(parseStarChatAction('{"type":"tool_call","toolName":"star.generateImage"}')).toMatchObject({ valid: false })
  })

  it('builds compact action messages with common tools, searched tools, tool.search, and scratchpad', () => {
    const messages = buildStarChatActionMessages({
      messages: [{ role: 'user', content: '画一张夕阳' }],
      commonTools: [toolCards[0]],
      searchedTools: [toolCards[1]],
      scratchpad: [{ type: 'tool_result', toolName: 'star.generateMusic', status: 'completed', output: { type: 'music' } }],
      validationErrors: ['不能否认已曝光工具能力。'],
    })
    const content = String(messages[0].content)

    expect(messages[0].role).toBe('system')
    expect(content).toContain('tool.search')
    expect(content).toContain('star.generateImage')
    expect(content).toContain('star.generateMusic')
    expect(content).toContain('tool_result')
    expect(content).toContain('不能否认已曝光工具能力')
    expect(content).not.toContain('"execute":')
  })

  it('merges base system context into the orchestrator system message', () => {
    const messages = buildStarChatActionMessages({
      messages: [
        { role: 'system', content: '星信人设上下文。' },
        { role: 'user', content: '你好' },
      ],
      commonTools: [toolCards[0]],
    })

    expect(messages.filter(message => message.role === 'system')).toHaveLength(1)
    expect(messages[0].content).toContain('星信人设上下文。')
    expect(messages.at(-1)).toEqual({ role: 'user', content: '你好' })
  })

  it('rejects calls to tools that were not exposed to the model', () => {
    const result = validateStarChatAction({
      action: {
        type: 'tool_call',
        toolName: 'star.generateImage',
        input: { prompt: '夕阳' },
        mode: 'execute',
        reason: '用户要求画图。',
      },
      exposedToolNames: new Set(['star.generateMusic']),
      availableTools: toolCards,
      searchCount: 0,
      maxSearches: 2,
      capabilityToolNames: new Set(['star.generateImage']),
    })

    expect(result).toEqual({ valid: false, reason: 'Tool was not exposed to the model: star.generateImage' })
  })

  it('rejects media calls without required prompt input', () => {
    const result = validateStarChatAction({
      action: {
        type: 'tool_call',
        toolName: 'star.generateImage',
        input: {},
        mode: 'execute',
        reason: '用户要求画图。',
      },
      exposedToolNames: new Set(['star.generateImage']),
      availableTools: toolCards,
      searchCount: 0,
      maxSearches: 2,
      capabilityToolNames: new Set(['star.generateImage']),
    })

    expect(result).toEqual({ valid: false, reason: 'Missing required input: prompt' })
  })

  it('rejects propose mode when the tool policy does not require approval', () => {
    const result = validateStarChatAction({
      action: {
        type: 'tool_call',
        toolName: 'star.generateMusic',
        input: { prompt: '温柔的歌' },
        mode: 'propose',
        reason: '用户想听歌。',
      },
      exposedToolNames: new Set(['star.generateMusic']),
      availableTools: toolCards,
      searchCount: 0,
      maxSearches: 2,
      capabilityToolNames: new Set(['star.generateMusic']),
      policy: { autoRunLowRiskTasks: true },
    })

    expect(result).toEqual({ valid: false, reason: 'Tool does not require approval; use execute mode.' })
  })

  it('rejects tool calls that are only triggered by history instead of the current turn', () => {
    const result = validateStarChatAction({
      action: {
        type: 'tool_call',
        toolName: 'star.generateMusic',
        input: { prompt: '温柔的歌' },
        mode: 'execute',
        reason: '用户以前说过想听歌。',
      },
      exposedToolNames: new Set(['star.generateMusic']),
      availableTools: toolCards,
      searchCount: 0,
      maxSearches: 2,
      capabilityToolNames: new Set(),
    })

    expect(result).toEqual({ valid: false, reason: 'Tool call is not grounded in the current user turn' })
  })

  it('rejects unavailable answers when a matching capability tool is available', () => {
    const result = validateStarChatAction({
      action: {
        type: 'unavailable',
        reply: '我不能画画。',
        searched: false,
        reason: '模型自我限制。',
      },
      exposedToolNames: new Set(['star.generateImage']),
      availableTools: toolCards,
      searchCount: 0,
      maxSearches: 2,
      capabilityToolNames: new Set(['star.generateImage']),
    })

    expect(result).toEqual({ valid: false, reason: 'Action denies an available tool capability' })
  })

  it('rejects tool search after the search limit', () => {
    const result = validateStarChatAction({
      action: { type: 'tool_search', query: '发布', limit: 5 },
      exposedToolNames: new Set(),
      availableTools: toolCards,
      searchCount: 2,
      maxSearches: 2,
      capabilityToolNames: new Set(),
    })

    expect(result).toEqual({ valid: false, reason: 'Tool search limit reached' })
  })
})
