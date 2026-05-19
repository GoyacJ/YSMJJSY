import type { AgentToolBehavior, AgentToolCategory, AgentToolDefinition } from './agent-runtime'

type SearchAgentToolsInput = {
  tools: AgentToolDefinition[]
  query: string
  category?: AgentToolCategory
  behavior?: AgentToolBehavior
  limit?: number
}

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function includesTerm(value: string | undefined, query: string): boolean {
  return Boolean(query && value && normalizeText(value).includes(query))
}

function scoreTool(tool: AgentToolDefinition, query: string): number {
  if (!query) {
    return 0
  }

  let score = 0

  if (normalizeText(tool.name) === query || normalizeText(tool.title ?? '') === query) {
    score += 100
  }

  if (includesTerm(tool.name, query) || includesTerm(tool.title, query)) {
    score += 60
  }

  if (tool.aliases?.some(alias => includesTerm(alias, query))) {
    score += 80
  }

  if (includesTerm(tool.description, query) || includesTerm(tool.whenToUse, query)) {
    score += 30
  }

  return score
}

function toToolDefinition(tool: AgentToolDefinition): AgentToolDefinition {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    category: tool.category,
    behavior: tool.behavior,
    aliases: tool.aliases,
    whenToUse: tool.whenToUse,
    inputSchema: tool.inputSchema,
    riskLevel: tool.riskLevel,
    approvalRequired: tool.approvalRequired,
  }
}

export function searchAgentTools(input: SearchAgentToolsInput): AgentToolDefinition[] {
  const query = normalizeText(input.query)
  const limit = input.limit ?? 5

  return input.tools
    .filter(tool => !input.category || tool.category === input.category)
    .filter(tool => !input.behavior || tool.behavior === input.behavior)
    .map(tool => ({
      tool,
      score: scoreTool(tool, query),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.tool.name.localeCompare(right.tool.name)
    })
    .slice(0, limit)
    .map(result => toToolDefinition(result.tool))
}
