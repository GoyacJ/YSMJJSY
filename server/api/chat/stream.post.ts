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
  createAgentEventRepository,
  createAgentInstanceRepository,
  createAgentObservationRepository,
  createAgentReflectionRepository,
  createAgentStateRepository,
  createAgentWorkRepository,
  createAttachmentRepository,
  createConversationRepository,
  createKeyProfileRepository,
  createMemoryRepository,
  createUsageLimitRepository,
  type AgentEvolutionProposalRecord,
  type AgentEventRecord,
  type AgentObservationRecord,
  type AgentReflectionRecord,
  type AgentStateRecord,
  type AgentWorkRecord,
  type MemoryRecord,
} from '../../db/sqlite'
import { buildAgentEvent } from '../../services/agent-events'
import { withMiniMaxErrorBoundary } from '../../services/api-errors'
import { resolveChatIntent } from '../../services/chat-intent'
import { createIpHash } from '../../services/key-access'
import { markKeyActivity } from '../../services/key-activity'
import { createMiniMaxClient } from '../../services/minimax'
import { createDefaultAgentProviderRegistry } from '../../services/agent-providers'
import { assertWithinLimit, usageLimits } from '../../services/rate-limit'
import {
  buildAgentReflectionMessages,
  calculateNextSleepAt,
  filterConflictingLearnedMemories,
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

function buildAgentWorkPreviewUrl(part: { type: string, url?: string, base64?: string }) {
  if (part.url) {
    return part.url
  }

  if (!part.base64) {
    return null
  }

  if (part.base64.startsWith('data:')) {
    return part.base64
  }

  if (part.type === 'image') {
    return `data:image/png;base64,${part.base64}`
  }

  if (part.type === 'video') {
    return `data:video/mp4;base64,${part.base64}`
  }

  return `data:audio/mpeg;base64,${part.base64}`
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
      previewUrl: buildAgentWorkPreviewUrl(part),
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

export function recordChatObservations(input: {
  agentId: string
  userConversationId: string
  assistantConversationId: string
  userSummary: string
  assistantSummary: string
  now: string
  observations: {
    addObservation: (record: AgentObservationRecord) => void
  }
  events: {
    addEvent: (record: AgentEventRecord) => void
  }
}) {
  const userObservationId = `observation_${nanoid()}`
  const assistantObservationId = `observation_${nanoid()}`

  input.observations.addObservation({
    id: userObservationId,
    agentId: input.agentId,
    sourceType: 'chat',
    sourceId: input.userConversationId,
    summary: input.userSummary,
    payloadJson: JSON.stringify({ conversationId: input.userConversationId, role: 'user' }),
    createdAt: input.now,
  })
  input.observations.addObservation({
    id: assistantObservationId,
    agentId: input.agentId,
    sourceType: 'chat',
    sourceId: input.assistantConversationId,
    summary: input.assistantSummary,
    payloadJson: JSON.stringify({ conversationId: input.assistantConversationId, role: 'assistant' }),
    createdAt: input.now,
  })
  input.events.addEvent(buildAgentEvent({
    id: `event_${nanoid()}`,
    agentId: input.agentId,
    type: 'observation.created',
    title: '观察记录',
    summary: '聊天输入流已记录。',
    targetType: 'observation',
    targetId: assistantObservationId,
    payload: { observationIds: [userObservationId, assistantObservationId] },
    createdAt: input.now,
  }))
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
    reflect?: (messages: ReturnType<typeof buildAgentReflectionMessages>) => Promise<string>
    reflectAgent?: (messages: ReturnType<typeof buildAgentReflectionMessages>) => Promise<string>
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
  agentId?: string
  events?: {
    addEvent: (record: AgentEventRecord) => void
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
    const reflect = input.client.reflect ?? input.client.reflectAgent

    if (!reflect) {
      throw new Error('Agent reflection provider is missing')
    }

    const rawJson = await reflect(messages)
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

    const governedMemories = filterConflictingLearnedMemories(
      filterRejectedLearnedMemories(result.learned, input.rejectedMemories ?? []),
      input.existingMemories,
    )

    for (const memory of governedMemories) {
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
  catch (error) {
    if (input.agentId && input.events) {
      input.events.addEvent(buildAgentEvent({
        id: `event_${nanoid()}`,
        agentId: input.agentId,
        type: 'provider.failed',
        title: 'Provider failed',
        summary: '学习反思失败。',
        targetType: 'reflection',
        targetId: input.conversationId,
        payload: {
          message: error instanceof Error ? error.message : 'unknown',
        },
        createdAt: new Date().toISOString(),
      }))
    }
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
  const agentInstances = createAgentInstanceRepository(config.sqlitePath)
  const observations = createAgentObservationRepository(config.sqlitePath)
  const agentEvents = createAgentEventRepository(config.sqlitePath)
  const attachmentRepo = createAttachmentRepository(config.sqlitePath)
  const profile = createKeyProfileRepository(config.sqlitePath).getKeyProfile(keyId)
  const usage = createUsageLimitRepository(config.sqlitePath)
  const client = createMiniMaxClient({
    apiKey: config.minimaxApiKey,
    groupId: config.minimaxGroupId,
  })
  const agentProviderRegistry = createDefaultAgentProviderRegistry({
    minimaxApiKey: config.minimaxApiKey,
    minimaxGroupId: config.minimaxGroupId,
  })
  const agentModelProvider = agentProviderRegistry.getDefault()
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
        let currentAgentId: string | undefined

        conversations.addConversation({
          id: assistantConversationId,
          keyId,
          role: 'assistant',
          content: result.message.content,
          messageJson: JSON.stringify(result.message),
          createdAt: assistantCreatedAt,
        })

        try {
          const agent = agentInstances.getOrCreateAgentForOwner({
            ownerType: 'key',
            ownerId: keyId,
            domain: 'star',
            now: assistantCreatedAt,
          })
          currentAgentId = agent.id

          recordChatObservations({
            agentId: agent.id,
            userConversationId,
            assistantConversationId,
            userSummary: body.data.message ? '用户发送了一条聊天消息。' : '用户发送了一条附件消息。',
            assistantSummary: '助手完成了一次回复。',
            now: assistantCreatedAt,
            observations,
            events: agentEvents,
          })
        }
        catch {
          // Observation capture is secondary. A failed insert should not hide the reply.
        }

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
          client: agentModelProvider,
          reflections,
          memories,
          proposals,
          agentId: currentAgentId,
          events: agentEvents,
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
