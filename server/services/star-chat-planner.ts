import { z } from 'zod'

import type { AgentToolBehavior, AgentToolCategory } from './agent-runtime'
import type { AgentToolDefinition, AgentToolRegistry, NamedAgentModelProvider } from './agent-runtime'
import type { MiniMaxMessage } from './minimax'
import { searchAgentTools } from './agent-tool-catalog'

const fallbackPlan = {
  reply: '',
  toolSearches: [],
  toolCalls: [],
} as const

const recordSchema = z.record(z.string(), z.unknown())

const toolSearchSchema = z.object({
  query: z.string().trim().default(''),
  category: z.enum(['reply', 'media', 'memory', 'design', 'publish', 'system']).optional(),
  behavior: z.enum(['present_reply', 'create', 'retrieve', 'mutate', 'publish']).optional(),
  limit: z.number().int().positive().max(5).optional(),
})

const toolCallSchema = z.object({
  toolName: z.string().trim().min(1),
  input: recordSchema,
  mode: z.enum(['execute', 'propose']),
  evidence: z.string().trim().default(''),
  reason: z.string().trim().default(''),
})

export const starChatTurnPlanSchema = z.object({
  reply: z.string().trim().default(''),
  toolSearches: z.array(toolSearchSchema).default([]).transform(searches => searches.slice(0, 2)),
  toolCalls: z.array(toolCallSchema).max(4).default([]),
})

export type StarChatToolSearch = {
  query: string
  category?: AgentToolCategory
  behavior?: AgentToolBehavior
  limit?: number
}

export type StarChatToolCall = {
  toolName: string
  input: Record<string, unknown>
  mode: 'execute' | 'propose'
  evidence: string
  reason: string
}

export type StarChatTurnPlan = {
  reply: string
  toolSearches: StarChatToolSearch[]
  toolCalls: StarChatToolCall[]
}

function unwrapMarkdownJson(text: string) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)

  return fenced?.[1]?.trim() ?? trimmed
}

export function parseStarChatTurnPlan(text: string): StarChatTurnPlan {
  try {
    const parsed = JSON.parse(unwrapMarkdownJson(text))
    return starChatTurnPlanSchema.parse(parsed)
  }
  catch {
    return { ...fallbackPlan }
  }
}

function toPlannerToolCard(tool: AgentToolDefinition) {
  return {
    name: tool.name,
    title: tool.title ?? tool.name,
    description: tool.description,
    category: tool.category,
    behavior: tool.behavior,
    aliases: tool.aliases ?? [],
    whenToUse: tool.whenToUse ?? '',
    riskLevel: tool.riskLevel,
    approvalRequired: tool.approvalRequired,
    inputSchema: tool.inputSchema ?? {},
  }
}

export function buildStarChatPlannerMessages(input: {
  messages: MiniMaxMessage[]
  commonTools: AgentToolDefinition[]
  searchedTools?: AgentToolDefinition[]
}): MiniMaxMessage[] {
  const cards = {
    commonTools: input.commonTools.map(toPlannerToolCard),
    searchedTools: (input.searchedTools ?? []).map(toPlannerToolCard),
  }

  return [
    {
      role: 'system',
      content: [
        '你是星信聊天规划器。只返回 JSON，不要返回 Markdown。',
        '输出结构：{"reply":"...","toolSearches":[],"toolCalls":[]}',
        '优先使用 commonTools。当前工具不足时，使用 tool.search 查询工具目录；每轮最多 2 次。',
        '不要编造工具。隐含动作使用 mode: "propose"，明确低风险动作可用 mode: "execute"。',
        '高风险动作可能被后端策略改为确认或拒绝。',
        `工具卡片：${JSON.stringify(cards)}`,
      ].join('\n'),
    },
    ...input.messages,
  ]
}

export async function planStarChatTurn(input: {
  provider: Pick<NamedAgentModelProvider, 'chat'>
  baseMessages: MiniMaxMessage[]
  registry: Pick<AgentToolRegistry, 'list'>
  commonToolNames: string[]
}): Promise<StarChatTurnPlan> {
  const tools = input.registry.list()
  const commonTools = input.commonToolNames
    .map(name => tools.find(tool => tool.name === name))
    .filter((tool): tool is AgentToolDefinition => Boolean(tool))

  const first = parseStarChatTurnPlan((await input.provider.chat(buildStarChatPlannerMessages({
    messages: input.baseMessages,
    commonTools,
  }))).reply)

  if (first.toolSearches.length < 1) {
    return first
  }

  const searchedTools = first.toolSearches.slice(0, 2).flatMap(search =>
    searchAgentTools({
      tools,
      query: search.query,
      category: search.category,
      behavior: search.behavior,
      limit: search.limit,
    }),
  )
  const uniqueSearchedTools = Array.from(
    new Map(searchedTools.map(tool => [tool.name, tool])).values(),
  )

  return parseStarChatTurnPlan((await input.provider.chat(buildStarChatPlannerMessages({
    messages: input.baseMessages,
    commonTools,
    searchedTools: uniqueSearchedTools,
  }))).reply)
}
