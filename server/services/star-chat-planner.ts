import { z } from 'zod'

import type { AgentToolBehavior, AgentToolCategory } from './agent-runtime'
import type { AgentToolDefinition } from './agent-runtime'
import { defaultAgentPolicy, evaluateAgentToolPolicy, type AgentPolicy } from './agent-policy'
import type { MiniMaxMessage } from './minimax'

const recordSchema = z.record(z.string(), z.unknown())

const toolSearchActionSchema = z.object({
  type: z.literal('tool_search'),
  query: z.string().trim().min(1),
  category: z.enum(['reply', 'media', 'memory', 'design', 'publish', 'system']).optional(),
  behavior: z.enum(['present_reply', 'create', 'retrieve', 'mutate', 'publish']).optional(),
  limit: z.number().int().positive().max(5).optional(),
})

const starChatActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('answer'),
    reply: z.string().trim().min(1),
  }),
  z.object({
    type: z.literal('clarify'),
    reply: z.string().trim().min(1),
    missingInputs: z.array(z.string().trim().min(1)).min(1),
  }),
  toolSearchActionSchema,
  z.object({
    type: z.literal('tool_call'),
    toolName: z.string().trim().min(1),
    input: recordSchema,
    mode: z.enum(['execute', 'propose']),
    reason: z.string().trim().default(''),
  }),
  z.object({
    type: z.literal('unavailable'),
    reply: z.string().trim().min(1),
    searched: z.boolean(),
    reason: z.string().trim().default(''),
  }),
])

export type StarChatAction = z.infer<typeof starChatActionSchema>
export type StarChatToolSearchAction = z.infer<typeof toolSearchActionSchema>
export type StarChatToolCallAction = Extract<StarChatAction, { type: 'tool_call' }>

export type StarChatActionParseResult =
  | { valid: true, action: StarChatAction }
  | { valid: false, reason: string, rawReply: string }

export type StarChatActionValidationResult =
  | { valid: true }
  | { valid: false, reason: string }

export type StarChatScratchpadItem =
  | { type: 'tool_search_result', query: string, tools: Array<Pick<AgentToolDefinition, 'name' | 'title' | 'category' | 'behavior' | 'capabilities' | 'outputTypes' | 'whenToUse' | 'cannotDo' | 'inputSchema' | 'riskLevel' | 'approvalRequired'>> }
  | { type: 'tool_result', toolName: string, status: string, output?: unknown, error?: string }
  | { type: 'validation_error', reason: string }

function unwrapMarkdownJson(text: string) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)

  return fenced?.[1]?.trim() ?? trimmed
}

export function parseStarChatAction(text: string): StarChatActionParseResult {
  try {
    return {
      valid: true,
      action: starChatActionSchema.parse(JSON.parse(unwrapMarkdownJson(text))),
    }
  }
  catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : 'Invalid action JSON',
      rawReply: text.trim(),
    }
  }
}

function toPlannerToolCard(tool: AgentToolDefinition) {
  return {
    name: tool.name,
    title: tool.title ?? tool.name,
    description: tool.description,
    category: tool.category,
    behavior: tool.behavior,
    capabilities: tool.capabilities ?? [],
    aliases: tool.aliases ?? [],
    whenToUse: tool.whenToUse ?? '',
    cannotDo: tool.cannotDo ?? '',
    outputTypes: tool.outputTypes ?? [],
    inputSchema: tool.inputSchema ?? {},
    riskLevel: tool.riskLevel,
    approvalRequired: tool.approvalRequired,
  }
}

export function toStarChatToolCard(tool: AgentToolDefinition) {
  return {
    name: tool.name,
    title: tool.title ?? tool.name,
    category: tool.category,
    behavior: tool.behavior,
    capabilities: tool.capabilities ?? [],
    outputTypes: tool.outputTypes ?? [],
    whenToUse: tool.whenToUse ?? '',
    cannotDo: tool.cannotDo ?? '',
    inputSchema: tool.inputSchema ?? {},
    riskLevel: tool.riskLevel,
    approvalRequired: tool.approvalRequired,
  }
}

export function buildStarChatActionMessages(input: {
  messages: MiniMaxMessage[]
  commonTools: AgentToolDefinition[]
  searchedTools?: AgentToolDefinition[]
  recentTools?: AgentToolDefinition[]
  scratchpad?: StarChatScratchpadItem[]
  validationErrors?: string[]
}): MiniMaxMessage[] {
  const systemContexts = input.messages
    .filter(message => message.role === 'system')
    .map(message => typeof message.content === 'string' ? message.content : JSON.stringify(message.content))
    .filter(Boolean)
  const conversationMessages = input.messages.filter(message => message.role !== 'system')
  const context = {
    commonTools: input.commonTools.map(toPlannerToolCard),
    recentTools: (input.recentTools ?? []).map(toPlannerToolCard),
    searchedTools: (input.searchedTools ?? []).map(toPlannerToolCard),
    virtualTools: [{
      name: 'tool.search',
      description: '搜索当前系统工具目录，只返回工具卡片，不执行业务工具。',
      inputSchema: { query: 'string', category: 'optional category', behavior: 'optional behavior', limit: 'optional number <= 5' },
    }],
    scratchpad: input.scratchpad ?? [],
    validationErrors: input.validationErrors ?? [],
  }

  return [
    {
      role: 'system',
      content: [
        '你是星信工具编排器。只返回 JSON，不要返回 Markdown。',
        '每轮只能返回一个 action。',
        '可选 action：',
        '{"type":"answer","reply":"..."}',
        '{"type":"clarify","reply":"...","missingInputs":["..."]}',
        '{"type":"tool_search","query":"...","category":"media|reply|memory|design|publish|system","behavior":"create|present_reply|retrieve|mutate|publish","limit":5}',
        '{"type":"tool_call","toolName":"...","input":{},"mode":"execute|propose","reason":"..."}',
        '{"type":"unavailable","reply":"...","searched":true,"reason":"..."}',
        '系统能力以工具卡片为准，不能因为语言模型自身限制否认工具卡片支持的能力。',
        '只能调用 commonTools、recentTools 或 searchedTools 中出现过的真实工具。',
        '当前工具不足时，先调用 tool.search。tool.search 不是业务工具。',
        '工具调用必须由当前最后一条用户消息明确触发。历史记忆只能辅助理解，不能单独触发媒体、语音或发布工具。',
        '只有工具卡片或策略确实要求用户审批时才使用 propose；普通图片、音乐、视频、语音生成使用 execute。',
        '真实工具执行后，会在 scratchpad 中返回 tool_result；根据结果继续调用工具或最终 answer。',
        '图片、音乐、视频、语音结果来自工具。不要说自己不能画图、不能做音乐、不能播放音乐、没有声音。',
        '缺少必要输入时返回 clarify。',
        '只有搜索后仍没有合适工具，才返回 unavailable。',
        ...(systemContexts.length ? ['对话上下文：', systemContexts.join('\n\n')] : []),
        `工具上下文：${JSON.stringify(context)}`,
      ].join('\n'),
    },
    ...conversationMessages,
  ]
}

function findTool(tools: AgentToolDefinition[], name: string) {
  return tools.find(tool => tool.name === name)
}

function requiredStringFields(tool: AgentToolDefinition): string[] {
  if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
    return []
  }

  return Object.entries(tool.inputSchema)
    .filter(([, value]) => value === 'string')
    .map(([key]) => key)
}

function deniesAvailableCapability(action: StarChatAction, capabilityToolNames: Set<string>) {
  if (capabilityToolNames.size < 1) {
    return false
  }

  if (action.type === 'unavailable') {
    return true
  }

  if (action.type !== 'answer') {
    return false
  }

  return /不能|无法|不会|没有.*(能力|工具|声音)|不能.*(画|图片|音乐|播放|唱|视频|语音)/.test(action.reply)
}

export function validateStarChatAction(input: {
  action: StarChatAction
  exposedToolNames: Set<string>
  availableTools: AgentToolDefinition[]
  searchCount: number
  maxSearches: number
  capabilityToolNames: Set<string>
  policy?: Partial<AgentPolicy>
}): StarChatActionValidationResult {
  const action = input.action

  if (action.type === 'tool_search') {
    return input.searchCount >= input.maxSearches
      ? { valid: false, reason: 'Tool search limit reached' }
      : { valid: true }
  }

  if (deniesAvailableCapability(action, input.capabilityToolNames)) {
    return { valid: false, reason: 'Action denies an available tool capability' }
  }

  if (action.type === 'unavailable' && !action.searched && input.searchCount < input.maxSearches) {
    return { valid: false, reason: 'Unavailable requires tool search first' }
  }

  if (action.type !== 'tool_call') {
    return { valid: true }
  }

  if (!input.exposedToolNames.has(action.toolName)) {
    return { valid: false, reason: `Tool was not exposed to the model: ${action.toolName}` }
  }

  const tool = findTool(input.availableTools, action.toolName)

  if (!tool) {
    return { valid: false, reason: `Unknown tool: ${action.toolName}` }
  }

  if (input.capabilityToolNames.size < 1) {
    return { valid: false, reason: 'Tool call is not grounded in the current user turn' }
  }

  if (!input.capabilityToolNames.has(action.toolName)) {
    return { valid: false, reason: `Tool call is not supported by the current user turn: ${action.toolName}` }
  }

  for (const field of requiredStringFields(tool)) {
    if (typeof action.input[field] !== 'string' || !action.input[field].trim()) {
      return { valid: false, reason: `Missing required input: ${field}` }
    }
  }

  if (action.mode === 'propose') {
    const decision = evaluateAgentToolPolicy({ ...defaultAgentPolicy, ...input.policy }, tool, action.input)

    if (!decision.approvalRequired) {
      return { valid: false, reason: 'Tool does not require approval; use execute mode.' }
    }
  }

  return { valid: true }
}

export type StarChatActionPlannerProvider = {
  chat: (messages: MiniMaxMessage[]) => Promise<{ reply: string }>
}

export async function planStarChatAction(input: {
  provider: StarChatActionPlannerProvider
  messages: MiniMaxMessage[]
  commonTools: AgentToolDefinition[]
  searchedTools?: AgentToolDefinition[]
  recentTools?: AgentToolDefinition[]
  scratchpad?: StarChatScratchpadItem[]
  validationErrors?: string[]
}): Promise<StarChatActionParseResult> {
  const result = await input.provider.chat(buildStarChatActionMessages({
    messages: input.messages,
    commonTools: input.commonTools,
    searchedTools: input.searchedTools,
    recentTools: input.recentTools,
    scratchpad: input.scratchpad,
    validationErrors: input.validationErrors,
  }))

  return parseStarChatAction(result.reply)
}

export type StarChatToolSearch = {
  query: string
  category?: AgentToolCategory
  behavior?: AgentToolBehavior
  limit?: number
}
