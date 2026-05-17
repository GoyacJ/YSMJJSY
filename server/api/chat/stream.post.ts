import { nanoid } from 'nanoid'
import { createError, defineEventHandler, readBody, setResponseHeaders } from 'h3'
import {
  buildStarChatMessages,
  chatBodySchema,
  selectAcceptedEvolutionNotes,
  selectActiveMemoryContents,
  selectRecentReflectionSummaries,
  streamStarChatReply,
} from '../../services/star-chat'
import {
  createAgentEvolutionRepository,
  createAgentReflectionRepository,
  createAgentStateRepository,
  createAgentWorkRepository,
  createAttachmentRepository,
  createConversationRepository,
  createKeyProfileRepository,
  createMemoryRepository,
  createUsageLimitRepository,
  type AgentEvolutionProposalRecord,
  type AgentReflectionRecord,
  type AgentStateRecord,
  type AgentWorkRecord,
  type MemoryRecord,
} from '../../db/sqlite'
import { withMiniMaxErrorBoundary } from '../../services/api-errors'
import { resolveChatIntent } from '../../services/chat-intent'
import { createIpHash } from '../../services/key-access'
import { markKeyActivity } from '../../services/key-activity'
import { createMiniMaxClient } from '../../services/minimax'
import { assertWithinLimit, usageLimits } from '../../services/rate-limit'
import {
  buildAgentReflectionMessages,
  calculateNextSleepAt,
  filterRejectedLearnedMemories,
  parseAgentReflectionResult,
  shouldScheduleAgentSleep,
} from '../../services/agent-learning'

function encodeSse(event: unknown) {
  return `data: ${JSON.stringify(event)}\n\n`
}

function getClientIp(event: Parameters<typeof readBody>[0]) {
  return event.node.req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
    || event.node.req.headers['x-real-ip']?.toString()
    || event.node.req.socket.remoteAddress
    || 'unknown'
}

function buildUserMessageJson(content: string, attachments: Array<{ kind: 'image' | 'audio' | 'video', dataUrl: string }>) {
  return {
    role: 'user' as const,
    content,
    parts: [
      { type: 'text' as const, text: content },
      ...attachments.map((attachment) => {
        if (attachment.kind === 'image') {
          return { type: 'image' as const, url: attachment.dataUrl }
        }

        if (attachment.kind === 'audio') {
          return { type: 'audio' as const, url: attachment.dataUrl }
        }

        return { type: 'video' as const, url: attachment.dataUrl }
      }),
    ],
  }
}

export function buildWorksFromAssistantMessage(input: {
  keyId: string
  conversationId: string
  now: string
  taskId?: string
  message: {
    role: 'assistant'
    content: string
    parts: Array<{ type: string, text?: string, url?: string, base64?: string }>
  }
}): AgentWorkRecord[] {
  const title = input.message.content.trim() || '智能体作品'
  const normalizedTitle = title.length > 32 ? `${title.slice(0, 32)}...` : title
  const mediaWorks = input.message.parts
    .filter(part => part.type === 'image' || part.type === 'music' || part.type === 'video')
    .map(part => ({
      id: nanoid(),
      keyId: input.keyId,
      type: part.type as AgentWorkRecord['type'],
      title: normalizedTitle,
      summary: input.message.content,
      sourceConversationId: input.conversationId,
      sourceMediaTaskId: input.taskId ?? null,
      sourceDesignVersion: null,
      previewUrl: part.url ?? part.base64 ?? null,
      payloadJson: JSON.stringify(part),
      visibility: 'private' as const,
      createdAt: input.now,
      updatedAt: input.now,
    }))

  if (mediaWorks.length > 0 || !input.taskId) {
    return mediaWorks
  }

  return [
    {
      id: nanoid(),
      keyId: input.keyId,
      type: 'video',
      title: normalizedTitle,
      summary: input.message.content,
      sourceConversationId: input.conversationId,
      sourceMediaTaskId: input.taskId,
      sourceDesignVersion: null,
      previewUrl: null,
      payloadJson: JSON.stringify({
        taskId: input.taskId,
        parts: input.message.parts,
      }),
      visibility: 'private',
      createdAt: input.now,
      updatedAt: input.now,
    },
  ]
}

type AgentLearningInput = {
  keyId: string
  conversationId: string
  userMessage: string
  assistantReply: string
  existingMemories: string[]
  rejectedMemories?: string[]
  profile: {
    assistantName?: string
    mbti?: string
    tone?: string
    relationshipRole?: string
  }
  client: {
    reflectAgent: (messages: ReturnType<typeof buildAgentReflectionMessages>) => Promise<string>
  }
  reflections: {
    addReflection: (record: AgentReflectionRecord) => void
  }
  memories: {
    addMemory: (record: MemoryRecord) => void
  }
  proposals: {
    addProposal: (record: AgentEvolutionProposalRecord) => void
  }
}

export function scheduleAgentSleepAfterChat(input: {
  keyId: string
  now: string
  newConversationCount: number
  agentState: Pick<AgentStateRecord, 'lastSleepAt' | 'nextSleepAt'>
  states: {
    updateAgentState: (keyId: string, updates: Partial<Omit<AgentStateRecord, 'keyId'>> & { updatedAt: string }) => void
  }
}) {
  if (!shouldScheduleAgentSleep({
    lastSleepAt: input.agentState.lastSleepAt,
    nextSleepAt: input.agentState.nextSleepAt,
    now: input.now,
    newConversationCount: input.newConversationCount,
  })) {
    return
  }

  input.states.updateAgentState(input.keyId, {
    nextSleepAt: calculateNextSleepAt(input.now),
    updatedAt: input.now,
  })
}

export async function runAgentLearning(input: AgentLearningInput) {
  try {
    const messages = buildAgentReflectionMessages({
      userMessage: input.userMessage,
      assistantReply: input.assistantReply,
      memories: input.existingMemories,
      profile: input.profile,
    })
    const rawJson = await input.client.reflectAgent(messages)
    const result = parseAgentReflectionResult(rawJson)
    const now = new Date().toISOString()
    const reflectionId = nanoid()

    input.reflections.addReflection({
      id: reflectionId,
      keyId: input.keyId,
      conversationId: input.conversationId,
      summary: result.summary,
      rawJson,
      createdAt: now,
    })

    for (const memory of filterRejectedLearnedMemories(result.learned, input.rejectedMemories ?? [])) {
      input.memories.addMemory({
        id: nanoid(),
        keyId: input.keyId,
        type: memory.type,
        content: memory.content,
        importance: memory.importance,
        confidence: memory.confidence,
        sourceConversationId: input.conversationId,
        status: memory.status,
        createdAt: now,
        updatedAt: now,
      })
    }

    for (const proposal of result.proposals) {
      input.proposals.addProposal({
        id: nanoid(),
        keyId: input.keyId,
        reflectionId,
        type: proposal.type,
        title: proposal.title,
        summary: proposal.summary,
        payloadJson: JSON.stringify(proposal.payload),
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })
    }
  }
  catch {
    // Agent learning is secondary. A failed reflection should not hide the reply.
  }
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
  const reflections = createAgentReflectionRepository(config.sqlitePath)
  const proposals = createAgentEvolutionRepository(config.sqlitePath)
  const states = createAgentStateRepository(config.sqlitePath)
  const agentState = states.getOrCreateAgentState(keyId, new Date().toISOString())
  const works = createAgentWorkRepository(config.sqlitePath)
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
  const savedMemoryRecords = memories.listMemoriesByKey(keyId)
  const savedMemories = selectActiveMemoryContents(savedMemoryRecords)
  const rejectedMemories = savedMemoryRecords
    .filter(memory => memory.status === 'rejected')
    .map(memory => memory.content)
  const recentReflections = selectRecentReflectionSummaries(reflections.listReflectionsByKey(keyId, 5))
  const acceptedEvolutionNotes = selectAcceptedEvolutionNotes(proposals.listProposalsByKey(keyId))
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
    tone: agentState.tone,
    relationshipRole: agentState.relationshipRole,
    contentStrategy: agentState.contentStrategy,
    recentReflections,
    acceptedEvolutionNotes,
    memories: savedMemories,
    recentConversation,
  })
  const intent = resolveChatIntent({
    message: body.data.message,
    forcedIntent: body.data.intent,
  })
  const now = new Date().toISOString()
  const userConversationId = nanoid()
  const encoder = new TextEncoder()

  conversations.addConversation({
    id: userConversationId,
    keyId,
    role: 'user',
    content: body.data.message || '[附件消息]',
    messageJson: JSON.stringify(buildUserMessageJson(body.data.message || '[附件消息]', body.data.attachments)),
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

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  })

  return new ReadableStream({
    async start(controller) {
      try {
        const result = await withMiniMaxErrorBoundary(
          () => streamStarChatReply({
            client,
            intent,
            messages,
            prompt: body.data.message,
            emit: streamEvent => controller.enqueue(encoder.encode(encodeSse(streamEvent))),
          }),
          'Chat generation failed',
        )

        const assistantConversationId = nanoid()

        const assistantCreatedAt = new Date().toISOString()

        conversations.addConversation({
          id: assistantConversationId,
          keyId,
          role: 'assistant',
          content: result.message.content,
          messageJson: JSON.stringify(result.message),
          createdAt: assistantCreatedAt,
        })

        try {
          scheduleAgentSleepAfterChat({
            keyId,
            now: assistantCreatedAt,
            newConversationCount: 1,
            agentState,
            states,
          })
        }
        catch {
          // Sleep scheduling is secondary. A failed reminder update should not hide the reply.
        }

        try {
          const createdAt = new Date().toISOString()
          for (const work of buildWorksFromAssistantMessage({
            keyId,
            conversationId: assistantConversationId,
            now: createdAt,
            taskId: result.taskId,
            message: result.message,
          })) {
            works.addWork(work)
          }
        }
        catch {
          // Work capture is secondary. A failed insert should not hide the reply.
        }

        try {
          markKeyActivity(config.sqlitePath, keyId, 'chat')
        }
        catch {
          // Public activity is secondary. A failed flash update should not hide the reply.
        }

        await runAgentLearning({
          keyId,
          conversationId: assistantConversationId,
          userMessage: body.data.message,
          assistantReply: result.reply,
          existingMemories: savedMemories,
          rejectedMemories,
          profile: {
            assistantName: profile?.assistantName || '星信',
            mbti: profile?.mbti || 'INTJ',
            tone: agentState.tone,
            relationshipRole: agentState.relationshipRole,
          },
          client,
          reflections,
          memories,
          proposals,
        })
      }
      catch {
        controller.enqueue(encoder.encode(encodeSse({ type: 'error', message: '星信刚刚走神了，等一下再试。' })))
      }
      finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })
})
