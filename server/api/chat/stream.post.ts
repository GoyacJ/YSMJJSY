import { nanoid } from 'nanoid'
import { join } from 'node:path'
import { createError, defineEventHandler, readBody, setResponseHeaders } from 'h3'
import {
  buildStarChatMessages,
  chatBodySchema,
  selectAcceptedEvolutionNotes,
  selectActiveMemoryContents,
  selectRecentReflectionSummaries,
  type StarChatApiReply,
} from '../../services/star-chat'
import {
  createAgentEvolutionRepository,
  createAgentEventRepository,
  createAgentInstanceRepository,
  createAgentObservationRepository,
  createAgentReflectionRepository,
  createAgentSleepRepository,
  createAgentStateRepository,
  createAgentTaskRepository,
  createAgentWorkRepository,
  createAttachmentRepository,
  createConversationRepository,
  createKeyProfileRepository,
  createMemoryRepository,
  createMemoryEventRepository,
  createMediaTaskRepository,
  createUsageLimitRepository,
  type AgentEvolutionProposalRecord,
  type AgentEventRecord,
  type AgentObservationRecord,
  type AgentReflectionRecord,
  type AgentStateRecord,
  type AgentWorkRecord,
  type MemoryRecord,
  type StarBoundarySettings,
} from '../../db/sqlite'
import { buildAgentEvent } from '../../services/agent-events'
import { withMiniMaxErrorBoundary } from '../../services/api-errors'
import { createIpHash } from '../../services/key-access'
import { markKeyActivity } from '../../services/key-activity'
import { createMiniMaxClient } from '../../services/minimax'
import { createDefaultAgentProviderRegistry } from '../../services/agent-providers'
import { writeBlobDataUrl } from '../../services/blob-storage'
import { attachGeneratedContentDisclosure } from '../../services/design-schema'
import { createAgentPolicyFromBoundarySettings, defaultAgentPolicy } from '../../services/agent-policy'
import type { AgentPolicy } from '../../services/agent-policy'
import { createAgentToolRegistry } from '../../services/agent-runtime'
import { registerStarAgentTools } from '../../services/star-agent-tools'
import { runStarChatToolOrchestrator } from '../../services/star-chat-orchestrator'
import { runManualAgentSleep, type ManualAgentSleepInput } from '../../services/agent-sleep'
import { assertWithinLimit, usageLimits } from '../../services/rate-limit'
import {
  buildAgentReflectionMessages,
  calculateNextSleepAt,
  applyBoundaryToLearnedMemories,
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

const commonStarChatToolNames = [
  'star.speakReply',
  'star.generateImage',
  'star.generateMusic',
  'star.generateVideo',
]

function matchesSearchText(query: string, values: string[]) {
  const normalized = query.trim().toLowerCase()

  return !normalized || values.some(value => value.toLowerCase().includes(normalized))
}

export function resolveStarChatAgentPolicy(profile?: { boundarySettings?: StarBoundarySettings | null }): AgentPolicy {
  return profile?.boundarySettings
    ? createAgentPolicyFromBoundarySettings(profile.boundarySettings)
    : defaultAgentPolicy
}

export function buildStarChatSleepRunner(input: ManualAgentSleepInput) {
  return (_toolInput: unknown) => runManualAgentSleep(input)
}

export function selectRecentStarChatToolNames(tasks: Array<{ inputJson: string }>, limit = 4): string[] {
  const names: string[] = []
  const seen = new Set<string>()

  for (const task of tasks) {
    try {
      const parsed = JSON.parse(task.inputJson) as { toolName?: unknown }
      const toolName = typeof parsed.toolName === 'string' ? parsed.toolName : ''

      if (!toolName || seen.has(toolName)) {
        continue
      }

      seen.add(toolName)
      names.push(toolName)

      if (names.length >= limit) {
        break
      }
    }
    catch {
      // Ignore malformed historical task input.
    }
  }

  return names
}

export function buildUserMessageJson(content: string, attachments: Array<{ kind: 'image' | 'audio' | 'video', dataUrl?: string, url?: string, attachmentId?: string }>) {
  return {
    role: 'user' as const,
    content,
    parts: [
      { type: 'text' as const, text: content },
      ...attachments.map((attachment) => {
        const url = attachment.url ?? attachment.dataUrl
        const meta = attachment.attachmentId ? { attachmentId: attachment.attachmentId } : {}

        if (attachment.kind === 'image') {
          return { type: 'image' as const, url, ...meta }
        }

        if (attachment.kind === 'audio') {
          return { type: 'audio' as const, url, ...meta }
        }

        return { type: 'video' as const, url, ...meta }
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

function getInlineMediaDataUrl(part: { type: string, url?: string, base64?: string }) {
  if (part.url?.startsWith('data:')) {
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

function getAttachmentType(type: string) {
  if (type === 'image' || type === 'video') {
    return type
  }

  return 'audio'
}

function getAttachmentMimeType(type: string) {
  if (type === 'image') {
    return 'image/png'
  }

  if (type === 'video') {
    return 'video/mp4'
  }

  return 'audio/mpeg'
}

export function buildStoredAssistantMessage(input: {
  keyId: string
  conversationId: string
  now: string
  message: {
    role: 'assistant'
    content: string
    parts: Array<{ type: string, text?: string, url?: string, base64?: string }>
  }
  blobRoot?: string
  attachments: {
    addAttachment: (record: {
      id: string
      keyId: string
      conversationId: string
      type: 'image' | 'video' | 'audio'
      mimeType: string
      filename: string
      dataUrl: string
      createdAt: string
    }) => void
  }
}) {
  return {
    ...input.message,
    parts: input.message.parts.map((part) => {
      if (!['audio', 'image', 'music', 'video'].includes(part.type)) {
        return part
      }

      const dataUrl = getInlineMediaDataUrl(part)

      if (!dataUrl) {
        return part
      }

      const id = nanoid()
      const blob = writeBlobDataUrl({
        root: input.blobRoot ?? join(process.cwd(), 'data/uploads'),
        keyId: input.keyId,
        id,
        dataUrl,
      })
      const type = getAttachmentType(part.type)

      input.attachments.addAttachment({
        id,
        keyId: input.keyId,
        conversationId: input.conversationId,
        type,
        mimeType: getAttachmentMimeType(part.type),
        filename: `generated-${part.type}`,
        dataUrl: `blob:${blob.relativePath}`,
        createdAt: input.now,
      })

      return {
        type: part.type,
        url: `/api/attachments/${id}`,
        attachmentId: id,
      }
    }),
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
    .filter(part => (part.type === 'image' || part.type === 'music' || part.type === 'video') && (part.url || part.base64))
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
      payloadJson: JSON.stringify(attachGeneratedContentDisclosure(part, {
        generatedAt: input.now,
      })),
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
      payloadJson: JSON.stringify(attachGeneratedContentDisclosure({
        taskId: input.taskId,
        parts: input.message.parts,
      }, {
        generatedAt: input.now,
      })),
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
  boundarySettings?: StarBoundarySettings
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

    const governedMemories = applyBoundaryToLearnedMemories(result.learned, {
      boundarySettings: input.boundarySettings,
      activeMemories: input.existingMemories,
      rejectedMemories: input.rejectedMemories ?? [],
    })

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
    try {
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
    }
    catch {
      // Failure reporting is secondary too.
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
  const agentTasks = createAgentTaskRepository(config.sqlitePath)
  const observations = createAgentObservationRepository(config.sqlitePath)
  const agentEvents = createAgentEventRepository(config.sqlitePath)
  const attachmentRepo = createAttachmentRepository(config.sqlitePath)
  const memoryEvents = createMemoryEventRepository(config.sqlitePath)
  const mediaTasks = createMediaTaskRepository(config.sqlitePath)
  const sleeps = createAgentSleepRepository(config.sqlitePath)
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
  const firstImageDataUri = firstImage?.dataUrl
  const imageDescription = firstImageDataUri
    ? await withMiniMaxErrorBoundary(
        () => client.describeImage(firstImageDataUri, body.data.message || '请描述这张图片，保留和情绪、场景、文字有关的信息。'),
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
  const now = new Date().toISOString()
  const userConversationId = nanoid()
  const storedAttachments = body.data.attachments.map((attachment) => {
    const id = nanoid()
    const blob = writeBlobDataUrl({
      root: join(process.cwd(), 'data/uploads'),
      keyId,
      id,
      dataUrl: attachment.dataUrl,
    })

    return {
      ...attachment,
      id,
      attachmentId: id,
      url: `/api/attachments/${id}`,
      blobRef: `blob:${blob.relativePath}`,
    }
  })
  const encoder = new TextEncoder()

  conversations.addConversation({
    id: userConversationId,
    keyId,
    role: 'user',
    content: body.data.message || '[附件消息]',
    messageJson: JSON.stringify(buildUserMessageJson(body.data.message || '[附件消息]', storedAttachments)),
    createdAt: now,
  })
  for (const attachment of storedAttachments) {
    attachmentRepo.addAttachment({
      id: attachment.id,
      keyId,
      conversationId: userConversationId,
      type: attachment.kind,
      mimeType: attachment.mimeType,
      filename: attachment.name,
      dataUrl: attachment.blobRef,
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
        let currentAgentId: string | undefined
        const emit = (streamEvent: Parameters<typeof encodeSse>[0]) => {
          controller.enqueue(encoder.encode(encodeSse(streamEvent)))
        }
        const result = await withMiniMaxErrorBoundary(
          async () => {
            const agent = agentInstances.getOrCreateAgentForOwner({
              ownerType: 'key',
              ownerId: keyId,
              domain: 'star',
              now,
            })
            currentAgentId = agent.id
            const recentToolNames = selectRecentStarChatToolNames(agentTasks.listTasksByAgent(agent.id, 8))

            const registry = createAgentToolRegistry()

            registerStarAgentTools(registry, {
              keyId,
              now,
              provider: agentModelProvider,
              media: {
                generateImage: prompt => client.generateImage(prompt),
                generateMusic: prompt => client.generateMusic(prompt),
                createVideoTask: prompt => client.createVideoTask(prompt),
              },
              mediaTasks,
              reply: {
                speak: text => client.textToSpeech(text),
              },
              memorySearch: {
                search: (searchKeyId, query, limit) => memories
                  .listMemoriesByKey(searchKeyId)
                  .filter(memory => matchesSearchText(query, [memory.content, memory.type]))
                  .slice(0, limit),
              },
              workSearch: {
                search: (searchKeyId, query, limit) => works
                  .listWorksByKey(searchKeyId)
                  .filter(work => matchesSearchText(query, [work.title, work.summary, work.type]))
                  .slice(0, limit),
              },
              sleep: buildStarChatSleepRunner({
                keyId,
                now,
                client: agentModelProvider,
                profile: {
                  assistantName: profile?.assistantName || '星信',
                  mbti: profile?.mbti || 'INTJ',
                },
                agentState,
                memories,
                conversations,
                reflections,
                proposals,
                sleeps,
                states,
              }),
              works,
              memories,
              memoryEvents,
            })

            return await runStarChatToolOrchestrator({
              prompt: body.data.message,
              attachmentKinds: body.data.attachments.map(attachment => attachment.kind),
              baseMessages: messages,
              provider: agentModelProvider,
              registry,
              commonToolNames: commonStarChatToolNames,
              recentToolNames,
              agentId: agent.id,
              now,
              tasks: agentTasks,
              events: agentEvents,
              policy: resolveStarChatAgentPolicy(profile),
              emit,
            })
          },
          'Chat generation failed',
        )

        const assistantConversationId = nanoid()

        const assistantCreatedAt = new Date().toISOString()

        const storedAssistantMessage = buildStoredAssistantMessage({
          keyId,
          conversationId: assistantConversationId,
          now: assistantCreatedAt,
          message: result.message,
          attachments: attachmentRepo,
        })

        conversations.addConversation({
          id: assistantConversationId,
          keyId,
          role: 'assistant',
          content: result.message.content,
          messageJson: JSON.stringify(storedAssistantMessage),
          createdAt: assistantCreatedAt,
        })

        try {
          if (currentAgentId) {
            recordChatObservations({
              agentId: currentAgentId,
              userConversationId,
              assistantConversationId,
              userSummary: body.data.message ? '用户发送了一条聊天消息。' : '用户发送了一条附件消息。',
              assistantSummary: '助手完成了一次回复。',
              now: assistantCreatedAt,
              observations,
              events: agentEvents,
            })
          }
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
            message: storedAssistantMessage,
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
          boundarySettings: profile?.boundarySettings,
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
