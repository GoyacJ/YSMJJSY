import { z } from 'zod'
import { finalConfession, letterParagraphs, memoryMoments } from '../../content/letter'
import { starLetterPersona } from '../../content/persona'
import type { AgentContentStrategy, AgentEvolutionProposalRecord, AgentReflectionRecord, ConversationRecord, MemoryRecord } from '../db/sqlite'
import type { MiniMaxMessage, createMiniMaxClient } from './minimax'

export const chatBodySchema = z.object({
  message: z.string().trim().max(1000).default(''),
  attachments: z.array(z.object({
    kind: z.enum(['image', 'video', 'audio']),
    dataUrl: z.string().regex(/^data:(?:image\/(?:png|jpeg|webp)|audio\/(?:mpeg|mp3|mp4|m4a|wav|webm)|video\/(?:mp4|webm|quicktime));base64,[A-Za-z0-9+/=]+$/).max(28_000_000),
    name: z.string().trim().min(1).max(160),
    mimeType: z.string().trim().min(1).max(80),
  })).max(3).default([]),
}).refine(data => data.message.length > 0 || data.attachments.length > 0, {
  message: 'Message or image is required',
})

type BuildStarChatMessagesInput = {
  userMessage: string
  imageDescription?: string
  attachmentNotes?: string[]
  assistantName?: string
  mbti?: string
  tone?: string
  relationshipRole?: string
  contentStrategy?: AgentContentStrategy
  recentReflections?: string[]
  acceptedEvolutionNotes?: string[]
  memories: string[]
  recentConversation: Pick<ConversationRecord, 'role' | 'content'>[]
}

export type StarChatMessagePart =
  | { type: 'text', text: string }
  | { type: 'audio', url?: string, base64?: string }
  | { type: 'image', url?: string, base64?: string }
  | { type: 'music', url?: string, base64?: string, taskId?: string, providerTaskId?: string, status?: string }
  | { type: 'video', url?: string, base64?: string, providerTaskId?: string, status?: string }
  | { type: 'status', text: string }

export type StarChatApiReply = {
  reply: string
  message: {
    role: 'assistant'
    content: string
    parts: StarChatMessagePart[]
  }
  taskId?: string
}

export type StarChatTextClient = Pick<
  ReturnType<typeof createMiniMaxClient>,
  'chatStream'
>

export type StarChatStreamEvent =
  | { type: 'delta', text: string }
  | { type: 'status', text: string }
  | { type: 'tool-status', text: string, visibility?: 'user' | 'debug' }
  | { type: 'tool-confirmation', taskId: string, inboxItemId: string, title: string, summary: string }
  | StarChatApiReply & { type: 'message' }

export const starChatStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({ type: z.literal('status'), text: z.string() }),
  z.object({
    type: z.literal('tool-status'),
    text: z.string(),
    visibility: z.enum(['user', 'debug']).optional(),
  }),
  z.object({
    type: z.literal('tool-confirmation'),
    taskId: z.string(),
    inboxItemId: z.string(),
    title: z.string(),
    summary: z.string(),
  }),
  z.object({
    type: z.literal('message'),
    reply: z.string(),
    message: z.object({
      role: z.literal('assistant'),
      content: z.string(),
      parts: z.array(z.record(z.string(), z.unknown())),
    }),
    taskId: z.string().optional(),
  }),
])

function buildLetterContext() {
  const paragraphs = letterParagraphs.map(item => `- ${item.text}`).join('\n')
  const moments = memoryMoments.map(item => `- ${item.date}: ${item.text}`).join('\n')

  return [
    '信件正文：',
    paragraphs,
    '',
    '记忆节点：',
    moments,
    '',
    `最终告白：${finalConfession.title}。${finalConfession.subtitle}`,
  ].join('\n')
}

export function buildStarChatMessages(input: BuildStarChatMessagesInput): MiniMaxMessage[] {
  const assistantName = input.assistantName || '星信'
  const mbti = input.mbti || 'INTJ'
  const memoryText = input.memories.length > 0
    ? input.memories.map(item => `- ${item}`).join('\n')
    : '还没有被允许保存的情绪或偏好。'
  const userContentParts = [
    input.userMessage || '请看附件，用温柔简洁的方式回应。',
  ]

  if (input.imageDescription) {
    userContentParts.push('', `用户附带图片描述：${input.imageDescription}`)
  }

  if (input.attachmentNotes?.length) {
    userContentParts.push('', ...input.attachmentNotes)
  }

  const userContent = userContentParts.join('\n')

  return [
    {
      role: 'system',
      content: [
        starLetterPersona,
        '',
        `你的称呼是：${assistantName}`,
        `MBTI 性格设定：${mbti}`,
        '',
    buildLetterContext(),
    '',
    ...(input.tone ? [`语气：${input.tone}`, ''] : []),
    ...(input.relationshipRole ? [`关系角色：${input.relationshipRole}`, ''] : []),
    ...(input.contentStrategy
      ? [
          '内容策略：',
          ...(input.contentStrategy.replyLength ? [`回复长度：${input.contentStrategy.replyLength}`] : []),
          ...(input.contentStrategy.structure ? [`结构：${input.contentStrategy.structure}`] : []),
          ...(input.contentStrategy.initiative ? [`主动性：${input.contentStrategy.initiative}`] : []),
          '',
        ]
      : []),
    ...(input.recentReflections?.length
      ? ['近期反思：', input.recentReflections.map(item => `- ${item}`).join('\n'), '']
      : []),
    ...(input.acceptedEvolutionNotes?.length
      ? ['已确认的演进：', input.acceptedEvolutionNotes.map(item => `- ${item}`).join('\n'), '']
      : []),
    '已保存记忆：',
    memoryText,
  ].join('\n'),
    },
    ...input.recentConversation.map(item => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: item.content,
    }) satisfies MiniMaxMessage),
    {
      role: 'user',
      content: userContent,
    },
  ]
}

export function selectActiveMemoryContents(memories: MemoryRecord[]) {
  return memories
    .filter(memory => (memory.status ?? 'active') === 'active' && memory.importance >= 0.5)
    .map(memory => memory.content)
}

export function selectRecentReflectionSummaries(reflections: AgentReflectionRecord[]) {
  return reflections.map(reflection => reflection.summary).filter(Boolean)
}

export function selectAcceptedEvolutionNotes(proposals: AgentEvolutionProposalRecord[]) {
  return proposals
    .filter(proposal => proposal.status === 'accepted' || proposal.status === 'applied')
    .map(proposal => proposal.summary)
    .filter(Boolean)
}

export function buildMemoryExtractionMessages(userMessage: string, assistantReply: string): MiniMaxMessage[] {
  return [
    {
      role: 'system',
      content: [
        '从下面对话中提取需要长期记住的情绪或偏好。',
        '只保存对方主动明确表达的内容。',
        '不要保存推断、猜测、恋爱状态或敏感身份信息。',
        '只返回 JSON。格式：{"shouldRemember":true,"type":"emotion","content":"...","importance":0.7}',
        '如果没有可保存内容，返回 {"shouldRemember":false,"type":"emotion","content":"","importance":0}',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `用户：${userMessage}\n星信：${assistantReply}`,
    },
  ]
}

export async function streamStarChatTextReply(input: {
  client: StarChatTextClient
  messages: MiniMaxMessage[]
  emit: (event: Extract<StarChatStreamEvent, { type: 'delta' }>) => void | Promise<void>
}) {
  let reply = ''

  for await (const delta of input.client.chatStream(input.messages)) {
    reply += delta
    await input.emit({ type: 'delta', text: delta })
  }

  return reply
}
