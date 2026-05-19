import type { AgentToolBehavior, AgentToolCategory, AgentToolDefinition } from './agent-runtime'

type SearchAgentToolsInput = {
  tools: AgentToolDefinition[]
  query: string
  category?: AgentToolCategory
  behavior?: AgentToolBehavior
  limit?: number
}

type BuildChatToolCandidatesInput = {
  tools: AgentToolDefinition[]
  message: string
  attachmentKinds: string[]
  recentToolNames: string[]
  commonToolNames: string[]
  commonLimit?: number
  retrievedLimit?: number
}

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function normalizeSearchText(value: string): string {
  return normalizeText(value)
    .replace(/请|帮我|给我|一下/g, '')
    .replace(/一个|一首|一张|一些|个|首|张/g, '')
    .replace(/\s+/g, '')
}

function containsQuery(value: string | undefined, query: string): boolean {
  if (!query || !value) {
    return false
  }

  return normalizeText(value).includes(query) || normalizeSearchText(value).includes(normalizeSearchText(query))
}

function queryContains(value: string | undefined, query: string): boolean {
  if (!query || !value) {
    return false
  }

  return query.includes(normalizeText(value)) || normalizeSearchText(query).includes(normalizeSearchText(value))
}

function hasAnySignal(value: string, signals: RegExp[]): boolean {
  return signals.some(signal => signal.test(value))
}

function scoreModalityIntent(tool: AgentToolDefinition, query: string): number {
  const text = normalizeSearchText(query)
  const rawText = normalizeText(query).replace(/\s+/g, '')
  const capabilities = tool.capabilities ?? []
  const outputTypes = tool.outputTypes ?? []
  const isReadAloudIntent = hasAnySignal(rawText, [/朗读/, /读/, /念/, /语音回复/, /用语音/, /说给/])
  const isCasualHearsay = hasAnySignal(rawText, [/听说/, /听起来/, /听懂/])
  const hasMusicSubject = hasAnySignal(rawText, [/音乐/, /歌曲/, /歌/, /曲/, /旋律/, /配乐/, /唱/])
  const hasAuditoryConsumption = !isCasualHearsay && hasAnySignal(rawText, [/想听/, /听点/, /听些/, /播放/, /放.*首/, /来点/, /来.*首/])

  if (
    outputTypes.includes('music')
    && (capabilities.includes('generate_music') || capabilities.includes('generate_song'))
    && (hasMusicSubject || (hasAuditoryConsumption && !isReadAloudIntent))
  ) {
    return 90
  }

  if (
    outputTypes.includes('audio')
    && capabilities.includes('text_to_speech')
    && isReadAloudIntent
  ) {
    return 90
  }

  if (
    outputTypes.includes('image')
    && capabilities.includes('generate_image')
    && hasAnySignal(rawText, [/图片/, /图像/, /画/, /插画/, /海报/, /照片/, /封面/])
  ) {
    return 90
  }

  if (
    outputTypes.includes('video')
    && capabilities.includes('generate_video')
    && hasAnySignal(text, [/视频/, /短片/, /影片/, /动画/])
  ) {
    return 90
  }

  return 0
}

function scoreTool(tool: AgentToolDefinition, query: string): number {
  if (!query) {
    return 0
  }

  let score = 0

  if (normalizeText(tool.name) === query || normalizeText(tool.title ?? '') === query) {
    score += 120
  }

  if (containsQuery(tool.name, query) || containsQuery(tool.title, query) || queryContains(tool.name, query) || queryContains(tool.title, query)) {
    score += 60
  }

  if (tool.capabilities?.some(capability => normalizeText(capability) === query || query.includes(normalizeText(capability)))) {
    score += 80
  }

  if (tool.aliases?.some(alias => queryContains(alias, query))) {
    score += 80
  }

  if (tool.aliases?.some(alias => containsQuery(alias, query))) {
    score += 40
  }

  if (containsQuery(tool.description, query) || containsQuery(tool.whenToUse, query) || queryContains(tool.whenToUse, query)) {
    score += 30
  }

  score += scoreModalityIntent(tool, query)

  return score
}

function toToolDefinition(tool: AgentToolDefinition): AgentToolDefinition {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    category: tool.category,
    behavior: tool.behavior,
    capabilities: tool.capabilities,
    aliases: tool.aliases,
    whenToUse: tool.whenToUse,
    cannotDo: tool.cannotDo,
    outputTypes: tool.outputTypes,
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
    .filter(result => result.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.tool.name.localeCompare(right.tool.name)
    })
    .slice(0, limit)
    .map(result => toToolDefinition(result.tool))
}

function selectToolsByName(tools: AgentToolDefinition[], names: string[], limit: number) {
  const seen = new Set<string>()
  const byName = new Map(tools.map(tool => [tool.name, tool]))
  const selected: AgentToolDefinition[] = []

  for (const name of names) {
    if (selected.length >= limit) {
      break
    }

    if (seen.has(name)) {
      continue
    }

    seen.add(name)
    const tool = byName.get(name)

    if (tool) {
      selected.push(toToolDefinition(tool))
    }
  }

  return selected
}

export function buildChatToolCandidates(input: BuildChatToolCandidatesInput): {
  commonTools: AgentToolDefinition[]
  recentTools: AgentToolDefinition[]
  retrievedTools: AgentToolDefinition[]
} {
  const commonTools = selectToolsByName(input.tools, input.commonToolNames, input.commonLimit ?? 4)
  const recentTools = selectToolsByName(input.tools, input.recentToolNames, input.commonLimit ?? 4)

  const query = [
    input.message,
    ...input.attachmentKinds,
  ].filter(Boolean).join(' ')

  return {
    commonTools,
    recentTools,
    retrievedTools: searchAgentTools({
      tools: input.tools,
      query,
      limit: input.retrievedLimit ?? 6,
    }),
  }
}
