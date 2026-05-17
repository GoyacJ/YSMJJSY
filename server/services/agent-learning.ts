import type { MiniMaxMessage } from './minimax'
import { normalizeMemory, shouldPersistMemory, type NormalizedMemory } from './memory'

export type AgentEvolutionProposalType = 'tone' | 'relationship_role' | 'content_strategy'

export type ParsedAgentEvolutionProposal = {
  type: AgentEvolutionProposalType
  title: string
  summary: string
  payload: Record<string, unknown>
}

export type ParsedAgentReflection = {
  summary: string
  learned: NormalizedMemory[]
  proposals: ParsedAgentEvolutionProposal[]
}

type BuildAgentReflectionMessagesInput = {
  userMessage: string
  assistantReply: string
  memories: string[]
  profile: {
    assistantName?: string
    mbti?: string
    tone?: string
    relationshipRole?: string
  }
}

const allowedProposalTypes = new Set<AgentEvolutionProposalType>(['tone', 'relationship_role', 'content_strategy'])

export function buildAgentReflectionMessages(input: BuildAgentReflectionMessagesInput): MiniMaxMessage[] {
  const memories = input.memories.length > 0
    ? input.memories.map(item => `- ${item}`).join('\n')
    : '无'

  return [
    {
      role: 'system',
      content: [
        '你是这个 key 专属 AI agent 的学习模块。',
        '只返回 JSON，不要 Markdown。',
        'JSON 格式必须是 {"summary":"...","learned":[],"proposals":[]}。',
        'learned 只能包含明确表达且值得长期保存的记忆。',
        '记忆 type 只允许 emotion、preference、event、person、creative_asset。',
        'proposal type 只允许 tone、relationship_role、content_strategy。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        '当前 profile：',
        `assistantName: ${input.profile.assistantName || ''}`,
        `mbti: ${input.profile.mbti || ''}`,
        `tone: ${input.profile.tone || ''}`,
        `relationshipRole: ${input.profile.relationshipRole || ''}`,
        '',
        '已有记忆：',
        memories,
        '',
        `用户消息：${input.userMessage}`,
        `助手回复：${input.assistantReply}`,
      ].join('\n'),
    },
  ]
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeEvolutionProposal(value: unknown): ParsedAgentEvolutionProposal | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const proposal = value as Record<string, unknown>
  const type = readString(proposal.type)
  const title = readString(proposal.title)
  const summary = readString(proposal.summary)

  if (!allowedProposalTypes.has(type as AgentEvolutionProposalType) || !title || !summary) {
    return undefined
  }

  return {
    type: type as AgentEvolutionProposalType,
    title,
    summary,
    payload: proposal.payload && typeof proposal.payload === 'object' && !Array.isArray(proposal.payload)
      ? proposal.payload as Record<string, unknown>
      : {},
  }
}

export function normalizeLearnedMemory(value: unknown): NormalizedMemory | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const memory = value as Record<string, unknown>
  const candidate = {
    shouldRemember: memory.shouldRemember !== false,
    type: readString(memory.type),
    content: readString(memory.content),
    importance: typeof memory.importance === 'number' ? memory.importance : 0,
    confidence: typeof memory.confidence === 'number' ? memory.confidence : 1,
  }

  return shouldPersistMemory(candidate) ? normalizeMemory(candidate) : undefined
}

export function parseAgentReflectionResult(text: string): ParsedAgentReflection {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const learned = Array.isArray(parsed.learned)
      ? parsed.learned.map(normalizeLearnedMemory).filter(item => item !== undefined)
      : []
    const proposals = Array.isArray(parsed.proposals)
      ? parsed.proposals.map(normalizeEvolutionProposal).filter(item => item !== undefined)
      : []

    return {
      summary: readString(parsed.summary),
      learned,
      proposals,
    }
  }
  catch {
    return {
      summary: '',
      learned: [],
      proposals: [],
    }
  }
}
