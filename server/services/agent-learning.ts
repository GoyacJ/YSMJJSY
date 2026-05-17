import type { MiniMaxMessage } from './minimax'
import { normalizeMemory, shouldPersistMemory, type NormalizedMemory } from './memory'

export type AgentEvolutionProposalType = 'tone' | 'relationship_role' | 'content_strategy' | 'memory_weight' | 'page_design'

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

export type ParsedAgentSleepResult = {
  dailySummary: string
  memoryActions: Array<{
    memoryId: string
    action: 'confirm' | 'downgrade' | 'archive' | 'reject'
    reason: string
  }>
  proposals: ParsedAgentEvolutionProposal[]
  workIdeas: Array<{
    type: 'letter' | 'image' | 'music' | 'video' | 'page_design'
    title: string
    summary: string
  }>
  nextConversationHints: string[]
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

const allowedProposalTypes = new Set<AgentEvolutionProposalType>([
  'tone',
  'relationship_role',
  'content_strategy',
  'memory_weight',
  'page_design',
])

const allowedMemoryActions = new Set<ParsedAgentSleepResult['memoryActions'][number]['action']>([
  'confirm',
  'downgrade',
  'archive',
  'reject',
])

const allowedWorkIdeaTypes = new Set<ParsedAgentSleepResult['workIdeas'][number]['type']>([
  'letter',
  'image',
  'music',
  'video',
  'page_design',
])

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

export function buildAgentSleepMessages(input: {
  profile: { assistantName?: string, mbti?: string, tone?: string, relationshipRole?: string }
  memories: Array<{ id: string, content: string, importance: number, confidence: number }>
  reflections: string[]
  recentConversation: string[]
}): MiniMaxMessage[] {
  const memories = input.memories.length > 0
    ? input.memories
        .map(memory => `- ${memory.id}: ${memory.content} importance=${memory.importance} confidence=${memory.confidence}`)
        .join('\n')
    : '无'
  const reflections = input.reflections.length > 0
    ? input.reflections.map(item => `- ${item}`).join('\n')
    : '无'
  const recentConversation = input.recentConversation.length > 0
    ? input.recentConversation.map(item => `- ${item}`).join('\n')
    : '无'

  return [
    {
      role: 'system',
      content: [
        '你是这个 key 专属 AI agent 的睡眠整理模块。',
        '只返回严格 JSON，不要 Markdown，不要解释。',
        'JSON 格式必须是 {"dailySummary":"...","memoryActions":[],"proposals":[],"workIdeas":[],"nextConversationHints":[]}。',
        'memoryActions action 只允许 confirm、downgrade、archive、reject。',
        'proposal type 只允许 tone、relationship_role、content_strategy、memory_weight、page_design。',
        'workIdeas type 只允许 letter、image、music、video、page_design。',
        '不要决定公开任何内容。',
        '不要输出私钥、原始会话全文、IP、session 或其他私密字段。',
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
        '近期反思：',
        reflections,
        '',
        '近期对话摘要：',
        recentConversation,
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

function normalizeMemoryAction(value: unknown): ParsedAgentSleepResult['memoryActions'][number] | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const action = value as Record<string, unknown>
  const memoryId = readString(action.memoryId)
  const actionName = readString(action.action)
  const reason = readString(action.reason)

  if (!memoryId || !allowedMemoryActions.has(actionName as ParsedAgentSleepResult['memoryActions'][number]['action'])) {
    return undefined
  }

  return {
    memoryId,
    action: actionName as ParsedAgentSleepResult['memoryActions'][number]['action'],
    reason,
  }
}

function normalizeWorkIdea(value: unknown): ParsedAgentSleepResult['workIdeas'][number] | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const workIdea = value as Record<string, unknown>
  const type = readString(workIdea.type)
  const title = readString(workIdea.title)
  const summary = readString(workIdea.summary)

  if (!allowedWorkIdeaTypes.has(type as ParsedAgentSleepResult['workIdeas'][number]['type']) || !title || !summary) {
    return undefined
  }

  return {
    type: type as ParsedAgentSleepResult['workIdeas'][number]['type'],
    title,
    summary,
  }
}

export function parseAgentSleepResult(text: string): ParsedAgentSleepResult {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const memoryActions = Array.isArray(parsed.memoryActions)
      ? parsed.memoryActions.map(normalizeMemoryAction).filter(item => item !== undefined)
      : []
    const proposals = Array.isArray(parsed.proposals)
      ? parsed.proposals.map(normalizeEvolutionProposal).filter(item => item !== undefined)
      : []
    const workIdeas = Array.isArray(parsed.workIdeas)
      ? parsed.workIdeas.map(normalizeWorkIdea).filter(item => item !== undefined)
      : []
    const nextConversationHints = Array.isArray(parsed.nextConversationHints)
      ? parsed.nextConversationHints.map(readString).filter(Boolean)
      : []

    return {
      dailySummary: readString(parsed.dailySummary),
      memoryActions,
      proposals,
      workIdeas,
      nextConversationHints,
    }
  }
  catch {
    return {
      dailySummary: '',
      memoryActions: [],
      proposals: [],
      workIdeas: [],
      nextConversationHints: [],
    }
  }
}
