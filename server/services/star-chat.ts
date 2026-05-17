import { z } from 'zod'
import { Buffer } from 'node:buffer'
import { finalConfession, letterParagraphs, memoryMoments } from '../../content/letter'
import { starLetterPersona } from '../../content/persona'
import type { AgentContentStrategy, AgentEvolutionProposalRecord, AgentReflectionRecord, ConversationRecord, MemoryRecord } from '../db/sqlite'
import { getDefaultMusicPrompt, normalizeMediaPrompt } from './media'
import type { MiniMaxMessage, createMiniMaxClient } from './minimax'
import type { ResolvedChatIntent } from './chat-intent'

export const chatBodySchema = z.object({
  message: z.string().trim().max(1000).default(''),
  intent: z.enum(['auto', 'chat', 'audio', 'image', 'music', 'video']).default('auto'),
  attachments: z.array(z.object({
    kind: z.enum(['image', 'video', 'audio']),
    dataUrl: z.string().regex(/^data:(?:image\/(?:png|jpeg|webp)|audio\/(?:mpeg|mp3|mp4|m4a|wav|webm)|video\/(?:mp4|webm|quicktime));base64,[A-Za-z0-9+/=]+$/).max(28_000_000),
    name: z.string().trim().min(1).max(160),
    mimeType: z.string().trim().min(1).max(80),
  })).max(3).default([]),
  imageDataUrl: z.string()
    .regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
    .max(3_000_000)
    .optional(),
}).refine(data => data.message.length > 0 || data.imageDataUrl || data.attachments.length > 0, {
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
  | { type: 'music', url?: string, base64?: string }
  | { type: 'video', url?: string }
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

export type StarChatIntentClient = Pick<
  ReturnType<typeof createMiniMaxClient>,
  'chatStream' | 'textToSpeechStream' | 'generateImage' | 'generateMusicStream' | 'createVideoTask'
>

export type StarChatStreamEvent =
  | { type: 'delta', text: string }
  | { type: 'audio-delta', hex: string }
  | { type: 'music-delta', hex: string }
  | { type: 'status', text: string }
  | StarChatApiReply & { type: 'message' }

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

export async function streamStarChatReply(input: {
  client: StarChatIntentClient
  intent: ResolvedChatIntent
  messages: MiniMaxMessage[]
  prompt: string
  emit: (event: StarChatStreamEvent) => void | Promise<void>
}): Promise<StarChatApiReply> {
  if (input.intent === 'image') {
    await input.emit({ type: 'status', text: '正在画一张。' })
    const image = await input.client.generateImage(normalizeMediaPrompt(input.prompt))
    const reply = '画好了。'
    const result: StarChatApiReply = {
      reply,
      message: {
        role: 'assistant',
        content: reply,
        parts: [
          { type: 'text', text: reply },
          { type: 'image', ...image },
        ],
      },
    }

    await input.emit({ type: 'message', ...result })
    return result
  }

  if (input.intent === 'video') {
    await input.emit({ type: 'status', text: '视频开始生成了。' })
    const task = await input.client.createVideoTask(input.prompt)
    const reply = '视频开始生成了。'
    const result: StarChatApiReply = {
      reply,
      message: {
        role: 'assistant',
        content: reply,
        parts: [{ type: 'status', text: reply }],
      },
      taskId: task.providerTaskId,
    }

    await input.emit({ type: 'message', ...result })
    return result
  }

  if (input.intent === 'music') {
    await input.emit({ type: 'status', text: '正在写一首。' })
    let musicHex = ''

    for await (const hex of input.client.generateMusicStream(input.prompt || getDefaultMusicPrompt())) {
      musicHex += hex
      await input.emit({ type: 'music-delta', hex })
    }

    const reply = '写好了。'
    const result: StarChatApiReply = {
      reply,
      message: {
        role: 'assistant',
        content: reply,
        parts: [
          { type: 'text', text: reply },
          { type: 'music', base64: Buffer.from(musicHex, 'hex').toString('base64') },
        ],
      },
    }

    await input.emit({ type: 'message', ...result })
    return result
  }

  let reply = ''

  for await (const delta of input.client.chatStream(input.messages)) {
    reply += delta
    await input.emit({ type: 'delta', text: delta })
  }

  const parts: StarChatMessagePart[] = [{ type: 'text', text: reply }]

  if (input.intent === 'audio') {
    let audioHex = ''

    for await (const hex of input.client.textToSpeechStream(reply)) {
      audioHex += hex
      await input.emit({ type: 'audio-delta', hex })
    }

    parts.push({ type: 'audio', base64: Buffer.from(audioHex, 'hex').toString('base64') })
  }

  const result: StarChatApiReply = {
    reply,
    message: {
      role: 'assistant',
      content: reply,
      parts,
    },
  }

  await input.emit({ type: 'message', ...result })
  return result
}
