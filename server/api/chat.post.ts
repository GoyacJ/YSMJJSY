import { nanoid } from 'nanoid'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { finalConfession, letterParagraphs, memoryMoments } from '../../content/letter'
import { starLetterPersona } from '../../content/persona'
import { createConversationRepository, createMemoryRepository, type ConversationRecord } from '../db/sqlite'
import { createMiniMaxClient, type MiniMaxMessage } from '../services/minimax'
import { normalizeMemoryType, shouldPersistMemory } from '../services/memory'
import { withMiniMaxErrorBoundary } from '../services/api-errors'

const chatBodySchema = z.object({
  message: z.string().trim().min(1).max(1000),
})

type BuildStarChatMessagesInput = {
  userMessage: string
  memories: string[]
  recentConversation: Pick<ConversationRecord, 'role' | 'content'>[]
}

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
  const memoryText = input.memories.length > 0
    ? input.memories.map(item => `- ${item}`).join('\n')
    : '还没有被允许保存的情绪或偏好。'

  return [
    {
      role: 'system',
      content: [
        starLetterPersona,
        '',
        buildLetterContext(),
        '',
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
      content: input.userMessage,
    },
  ]
}

function buildMemoryExtractionMessages(userMessage: string, assistantReply: string): MiniMaxMessage[] {
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

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const body = chatBodySchema.safeParse(await readBody(event))

  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid chat message',
    })
  }

  const conversations = createConversationRepository(config.sqlitePath)
  const memories = createMemoryRepository(config.sqlitePath)
  const client = createMiniMaxClient({
    apiKey: config.minimaxApiKey,
    groupId: config.minimaxGroupId,
  })

  const recentConversation = conversations.listRecentConversations(12)
  const savedMemories = memories.listMemories().map(memory => memory.content)
  const messages = buildStarChatMessages({
    userMessage: body.data.message,
    memories: savedMemories,
    recentConversation,
  })

  const result = await withMiniMaxErrorBoundary(() => client.chat(messages), 'Chat generation failed')
  const now = new Date().toISOString()

  conversations.addConversation({
    id: nanoid(),
    role: 'user',
    content: body.data.message,
    createdAt: now,
  })
  conversations.addConversation({
    id: nanoid(),
    role: 'assistant',
    content: result.reply,
    createdAt: new Date().toISOString(),
  })

  try {
    const extracted = await client.extractMemory(buildMemoryExtractionMessages(body.data.message, result.reply))

    for (const memory of extracted) {
      if (!shouldPersistMemory(memory)) {
        continue
      }

      memories.addMemory({
        id: nanoid(),
        type: normalizeMemoryType(memory.type),
        content: memory.content.trim(),
        importance: memory.importance,
        createdAt: new Date().toISOString(),
      })
    }
  }
  catch {
    // Memory extraction is secondary. A failed extraction should not hide the reply.
  }

  return {
    reply: result.reply,
  }
})
