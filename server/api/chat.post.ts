import { nanoid } from 'nanoid'
import { createError, defineEventHandler, getRequestHeader, readBody } from 'h3'
import { z } from 'zod'
import { finalConfession, letterParagraphs, memoryMoments } from '../../content/letter'
import { starLetterPersona } from '../../content/persona'
import {
  createAttachmentRepository,
  createConversationRepository,
  createKeyProfileRepository,
  createMemoryRepository,
  createUsageLimitRepository,
  type ConversationRecord,
} from '../db/sqlite'
import { createMiniMaxClient, type MiniMaxMessage } from '../services/minimax'
import { normalizeMemoryType, shouldPersistMemory } from '../services/memory'
import { withMiniMaxErrorBoundary } from '../services/api-errors'
import { createIpHash } from '../services/key-access'
import { assertWithinLimit, usageLimits } from '../services/rate-limit'

const chatBodySchema = z.object({
  message: z.string().trim().max(1000).default(''),
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

function getClientIp(event: Parameters<typeof getRequestHeader>[0]) {
  return getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || getRequestHeader(event, 'x-real-ip')
    || event.node.req.socket.remoteAddress
    || 'unknown'
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
  const keyId = event.context.keyId
  const body = chatBodySchema.safeParse(await readBody(event))

  if (!keyId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid chat message',
    })
  }

  const conversations = createConversationRepository(config.sqlitePath)
  const memories = createMemoryRepository(config.sqlitePath)
  const attachmentRepo = createAttachmentRepository(config.sqlitePath)
  const profile = createKeyProfileRepository(config.sqlitePath).getKeyProfile(keyId)
  const usage = createUsageLimitRepository(config.sqlitePath)
  const client = createMiniMaxClient({
    apiKey: config.minimaxApiKey,
    groupId: config.minimaxGroupId,
  })
  const today = new Date().toISOString().slice(0, 10)
  const currentUsage = usage.getUsage(keyId, today)

  if (!assertWithinLimit({ current: currentUsage?.chatCount ?? 0, max: usageLimits.chatPerKeyPerDay })) {
    throw createError({
      statusCode: 429,
      statusMessage: '今天的星光先到这里。',
    })
  }

  if (body.data.attachments.length > 0 && !assertWithinLimit({ current: currentUsage?.uploadCount ?? 0, max: usageLimits.uploadPerKeyPerDay })) {
    throw createError({
      statusCode: 429,
      statusMessage: '今天的星光先到这里。',
    })
  }

  usage.incrementUsage({
    keyId,
    ipHash: createIpHash(getClientIp(event), config.sessionSecret),
    date: today,
    bucket: 'chat',
  })

  if (body.data.attachments.length > 0) {
    usage.incrementUsage({
      keyId,
      ipHash: createIpHash(getClientIp(event), config.sessionSecret),
      date: today,
      bucket: 'upload',
    })
  }

  const recentConversation = conversations.listRecentConversationsByKey(keyId, 12)
  const savedMemories = memories.listMemoriesByKey(keyId).map(memory => memory.content)
  const firstImage = body.data.attachments.find(attachment => attachment.kind === 'image')
  const imageDataUrl = body.data.imageDataUrl || firstImage?.dataUrl
  const imageDescription = imageDataUrl
    ? await withMiniMaxErrorBoundary(
        () => client.describeImage(imageDataUrl, body.data.message || '请描述这张图片，保留和情绪、场景、文字有关的信息。'),
        'Image understanding failed',
      )
    : undefined
  const attachmentNotes = body.data.attachments
    .filter(attachment => attachment.kind !== 'image')
    .map((attachment) => {
      const label = attachment.kind === 'audio' ? '音频' : '视频'
      return `用户附带了一个${label}文件：${attachment.name}，类型 ${attachment.mimeType}。当前版本不直接解析该文件内容。`
    })
  const messages = buildStarChatMessages({
    userMessage: body.data.message,
    imageDescription,
    attachmentNotes,
    assistantName: profile?.assistantName || '星信',
    mbti: profile?.mbti || 'INTJ',
    memories: savedMemories,
    recentConversation,
  })

  const result = await withMiniMaxErrorBoundary(() => client.chat(messages), 'Chat generation failed')
  const now = new Date().toISOString()
  const userConversationId = nanoid()

  conversations.addConversation({
    id: userConversationId,
    keyId,
    role: 'user',
    content: body.data.message || '[附件消息]',
    createdAt: now,
  })
  for (const attachment of body.data.attachments) {
    attachmentRepo.addAttachment({
      id: nanoid(),
      keyId,
      conversationId: userConversationId,
      type: attachment.kind,
      mimeType: attachment.mimeType,
      filename: attachment.name,
      dataUrl: attachment.dataUrl,
      createdAt: now,
    })
  }
  conversations.addConversation({
    id: nanoid(),
    keyId,
    role: 'assistant',
    content: result.reply,
    createdAt: new Date().toISOString(),
  })

  try {
    if (!body.data.message) {
      return {
        reply: result.reply,
      }
    }

    const extracted = await client.extractMemory(buildMemoryExtractionMessages(body.data.message, result.reply))

    for (const memory of extracted) {
      if (!shouldPersistMemory(memory)) {
        continue
      }

      memories.addMemory({
        id: nanoid(),
        keyId,
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
