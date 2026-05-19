import { describe, expect, it } from 'vitest'
import type { AgentToolDefinition } from './agent-runtime'
import { buildStarChatPlannerMessages, parseStarChatTurnPlan } from './star-chat-planner'

const toolCards: AgentToolDefinition[] = [
  {
    name: 'star.generateImage',
    title: '生成图片',
    description: 'Generate an image artifact.',
    category: 'media',
    behavior: 'create',
    aliases: ['图片'],
    whenToUse: '用户明确要求生成静态画面。',
    inputSchema: { prompt: 'string' },
    riskLevel: 'medium',
    approvalRequired: false,
  },
  {
    name: 'star.publishWork',
    title: '发布作品',
    description: 'Publish a private work.',
    category: 'publish',
    behavior: 'publish',
    aliases: ['公开'],
    whenToUse: '用户明确要求发布已有作品。',
    inputSchema: { workId: 'string' },
    riskLevel: 'high',
    approvalRequired: true,
  },
]

describe('star chat planner', () => {
  it('parses a valid turn plan', () => {
    expect(parseStarChatTurnPlan(JSON.stringify({
      reply: '可以。',
      toolSearches: [{ query: '发布作品', category: 'publish', behavior: 'publish', limit: 3 }],
      toolCalls: [
        {
          toolName: 'star.publishWork',
          input: { workId: 'work_1' },
          mode: 'propose',
          evidence: '用户说想公开这张图。',
          reason: '发布前需要确认。',
        },
      ],
    }))).toEqual({
      reply: '可以。',
      toolSearches: [{ query: '发布作品', category: 'publish', behavior: 'publish', limit: 3 }],
      toolCalls: [
        {
          toolName: 'star.publishWork',
          input: { workId: 'work_1' },
          mode: 'propose',
          evidence: '用户说想公开这张图。',
          reason: '发布前需要确认。',
        },
      ],
    })
  })

  it('parses markdown wrapped JSON', () => {
    expect(parseStarChatTurnPlan('```json\n{"reply":"你好","toolCalls":[]}\n```')).toEqual({
      reply: '你好',
      toolSearches: [],
      toolCalls: [],
    })
  })

  it('returns a fallback plan for invalid JSON', () => {
    expect(parseStarChatTurnPlan('not json')).toEqual({
      reply: '',
      toolSearches: [],
      toolCalls: [],
    })
  })

  it('rejects unknown tool call modes', () => {
    expect(parseStarChatTurnPlan(JSON.stringify({
      reply: 'x',
      toolCalls: [{ toolName: 'star.generateImage', input: {}, mode: 'run' }],
    }))).toEqual({
      reply: '',
      toolSearches: [],
      toolCalls: [],
    })
  })

  it('requires tool call input to be an object', () => {
    expect(parseStarChatTurnPlan(JSON.stringify({
      reply: 'x',
      toolCalls: [{ toolName: 'star.generateImage', input: 'bad', mode: 'execute' }],
    }))).toEqual({
      reply: '',
      toolSearches: [],
      toolCalls: [],
    })
  })

  it('builds compact planner messages with configured tools and tool.search instructions', () => {
    const messages = buildStarChatPlannerMessages({
      messages: [{ role: 'user', content: '画一张星空' }],
      commonTools: [toolCards[0]],
      searchedTools: [toolCards[1]],
    })
    const system = messages[0]
    const content = String(system.content)

    expect(system.role).toBe('system')
    expect(content.match(/tool\.search/g)).toHaveLength(1)
    expect(content).toContain('star.generateImage')
    expect(content).toContain('star.publishWork')
    expect(content).toContain('"inputSchema":{"prompt":"string"}')
    expect(content).not.toContain('"execute":')
    expect(messages.at(-1)).toEqual({ role: 'user', content: '画一张星空' })
  })

  it('does not include private data in planner tool cards', () => {
    const messages = buildStarChatPlannerMessages({
      messages: [],
      commonTools: [
        {
          ...toolCards[0],
          keyId: 'key_1',
          payloadJson: '{"base64":"raw"}',
          execute: () => Promise.resolve({ ok: true }),
        } as AgentToolDefinition,
      ],
    })
    const content = String(messages[0].content)

    expect(content).toContain('star.generateImage')
    expect(content).not.toContain('key_1')
    expect(content).not.toContain('payloadJson')
    expect(content).not.toContain('base64')
  })
})
