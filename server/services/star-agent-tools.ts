import type {
  AgentToolRegistry,
  AgentToolResult,
  NamedAgentModelProvider,
} from './agent-runtime'
import type { StarChatMessagePart } from './star-chat'
import type {
  AgentWorkRecord,
  AgentWorkVisibility,
  MediaTaskRecord,
  MemoryEventRecord,
  MemoryGovernanceAction,
  MemoryRecord,
  StarBoundarySettings,
} from '../db/sqlite'
import { nanoid } from 'nanoid'
import { attachGeneratedContentDisclosure } from './design-schema'

export type StarAgentToolContext = {
  keyId?: string
  now?: string
  boundarySettings?: StarBoundarySettings
  provider?: Pick<NamedAgentModelProvider, 'generateDesignPatch'>
  media?: {
    generateImage?: (prompt: string) => Promise<unknown>
    generateMusic?: (prompt: string) => Promise<unknown>
    createVideoTask?: (prompt: string) => Promise<unknown>
  }
  reply?: {
    speak?: (text: string) => Promise<{ url?: string, base64?: string }>
  }
  memorySearch?: {
    search: (
      keyId: string,
      query: string,
      limit: number
    ) => Array<{ id: string, content: string, status?: string }>
  }
  workSearch?: {
    search: (
      keyId: string,
      query: string,
      limit: number
    ) => Array<{ id: string, type: string, title: string, summary: string }>
  }
  works?: {
    addWork?: (record: AgentWorkRecord) => void
    getWorkByKey: (keyId: string, id: string) => Pick<AgentWorkRecord, 'id' | 'visibility'> | undefined
    updateWorkVisibility: (keyId: string, id: string, visibility: AgentWorkVisibility, updatedAt: string) => void
  }
  mediaTasks?: {
    addMediaTask?: (record: MediaTaskRecord) => void
    updateMediaTask?: (id: string, updates: Partial<Pick<MediaTaskRecord, 'providerTaskId' | 'status' | 'resultUrl' | 'error' | 'updatedAt'>>) => void
  }
  memories?: {
    getMemoryByKey: (keyId: string, id: string) => MemoryRecord | undefined
    updateMemory: (id: string, updates: { importance?: number, status?: 'active' | 'pending' | 'archived' | 'rejected', updatedAt: string }) => void
    deleteMemoryByKey: (keyId: string, id: string) => number
  }
  memoryEvents?: {
    addMemoryEvent: (record: MemoryEventRecord) => void
  }
  sleep?: (input: unknown) => Promise<unknown>
  commitDesign?: (input: unknown) => Promise<unknown> | unknown
}

function requireContextValue<T>(value: T | undefined, message: string): T {
  if (!value) {
    throw new Error(message)
  }

  return value
}

function readStringField(input: unknown, field: string) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`Missing ${field}`)
  }

  const value = (input as Record<string, unknown>)[field]

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing ${field}`)
  }

  return value.trim()
}

function readMemoryAction(input: unknown): MemoryGovernanceAction {
  const action = readStringField(input, 'action')

  if (action === 'confirm' || action === 'downgrade' || action === 'archive' || action === 'reject' || action === 'delete') {
    return action
  }

  throw new Error('Invalid memory action')
}

function readOptionalLimit(input: unknown, fallback = 5) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fallback
  }

  const value = (input as Record<string, unknown>).limit

  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(Math.floor(value), 1), 10)
    : fallback
}

async function runTool(action: () => Promise<unknown> | unknown): Promise<AgentToolResult> {
  try {
    return {
      ok: true,
      output: await action(),
    }
  }
  catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Agent tool failed',
    }
  }
}

async function runToolResult(action: () => Promise<AgentToolResult>): Promise<AgentToolResult> {
  try {
    return await action()
  }
  catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Agent tool failed',
    }
  }
}

function getPreviewUrl(output: unknown) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return null
  }

  const record = output as { url?: unknown, base64?: unknown, providerTaskId?: unknown }

  if (typeof record.url === 'string' && !isDataUrl(record.url)) {
    return record.url
  }

  if (typeof record.base64 === 'string') {
    return null
  }

  if (typeof record.providerTaskId === 'string') {
    return null
  }

  return null
}

function isDataUrl(value: string) {
  return value.startsWith('data:')
}

function readGeneratedMediaFields(output: unknown) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return {}
  }

  const record = output as { url?: unknown, base64?: unknown, providerTaskId?: unknown, taskId?: unknown, status?: unknown }

  return {
    ...(typeof record.url === 'string' ? { url: record.url } : {}),
    ...(typeof record.base64 === 'string' ? { base64: record.base64 } : {}),
    ...(typeof record.providerTaskId === 'string' ? { providerTaskId: record.providerTaskId } : {}),
    ...(typeof record.taskId === 'string' ? { taskId: record.taskId } : {}),
    ...(typeof record.status === 'string' ? { status: record.status } : {}),
  }
}

function buildMediaChatPart(
  type: Extract<AgentWorkRecord['type'], 'image' | 'music' | 'video'>,
  fields: { url?: string, base64?: string, providerTaskId?: string, taskId?: string, status?: string },
): StarChatMessagePart | undefined {
  if (fields.url) {
    return isDataUrl(fields.url)
      ? { type, base64: fields.url }
      : { type, url: fields.url }
  }

  if (fields.base64) {
    return { type, base64: fields.base64 }
  }

  if (type === 'music' && fields.status === 'processing') {
    return {
      type: 'music',
      status: 'processing',
      ...(fields.taskId ? { taskId: fields.taskId } : {}),
      ...(fields.providerTaskId ? { providerTaskId: fields.providerTaskId } : {}),
    }
  }

  if (type === 'video' && fields.providerTaskId) {
    return { type: 'video', providerTaskId: fields.providerTaskId, status: 'processing' }
  }

  return undefined
}

function addGeneratedMediaWork(input: {
  context: StarAgentToolContext
  type: Extract<AgentWorkRecord['type'], 'image' | 'music' | 'video'>
  prompt: string
  output: unknown
  sourceMediaTaskId?: string | null
}) {
  const addWork = input.context.works?.addWork
  const workId = nanoid()

  if (addWork) {
    const keyId = requireContextValue(input.context.keyId, 'Missing key id')
    const now = requireContextValue(input.context.now, 'Missing timestamp')

    addWork({
      id: workId,
      keyId,
      type: input.type,
      title: input.prompt.slice(0, 32) || '智能体作品',
      summary: input.prompt,
      sourceConversationId: null,
      sourceMediaTaskId: input.sourceMediaTaskId ?? null,
      sourceDesignVersion: null,
      previewUrl: getPreviewUrl(input.output),
      payloadJson: JSON.stringify(attachGeneratedContentDisclosure({
        type: input.type,
        prompt: input.prompt,
      }, {
        generatedAt: now,
      })),
      visibility: 'private',
      createdAt: now,
      updatedAt: now,
    })
  }

  return addWork ? workId : undefined
}

async function runMediaTool(input: {
  context: StarAgentToolContext
  type: Extract<AgentWorkRecord['type'], 'image' | 'music' | 'video'>
  prompt: string
  generate: (prompt: string) => Promise<unknown>
}): Promise<AgentToolResult> {
  const output = await input.generate(input.prompt)
  const fields = readGeneratedMediaFields(output)
  const workId = addGeneratedMediaWork({
    context: input.context,
    type: input.type,
    prompt: input.prompt,
    output,
  })

  const status = input.type === 'video' && fields.providerTaskId && !fields.url && !fields.base64
    ? 'processing'
    : 'created'
  const persistentOutput = {
    ...(workId ? { workId } : {}),
    type: input.type,
    status,
    ...(fields.url && !isDataUrl(fields.url) ? { url: fields.url } : {}),
    ...(fields.providerTaskId ? { providerTaskId: fields.providerTaskId } : {}),
  }
  const chatPart = buildMediaChatPart(input.type, fields)

  return {
    ok: true,
    output: persistentOutput,
    ...(chatPart ? { chatParts: [chatPart] } : {}),
  }
}

function runAsyncMusicTool(input: {
  context: StarAgentToolContext
  prompt: string
  generate: (prompt: string) => Promise<unknown>
}): AgentToolResult {
  const taskId = `media_task_${nanoid()}`
  const now = input.context.now ?? new Date().toISOString()

  input.context.mediaTasks?.addMediaTask?.({
    id: taskId,
    keyId: input.context.keyId ?? null,
    type: 'music',
    providerTaskId: null,
    status: 'processing',
    prompt: input.prompt,
    resultUrl: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  })

  void Promise.resolve()
    .then(() => input.generate(input.prompt))
    .then((output) => {
      const fields = readGeneratedMediaFields(output)
      const completedAt = new Date().toISOString()

      input.context.mediaTasks?.updateMediaTask?.(taskId, {
        providerTaskId: fields.providerTaskId,
        status: 'succeeded',
        resultUrl: fields.url && !isDataUrl(fields.url) ? fields.url : null,
        error: null,
        updatedAt: completedAt,
      })
      addGeneratedMediaWork({
        context: {
          ...input.context,
          now: completedAt,
        },
        type: 'music',
        prompt: input.prompt,
        output,
        sourceMediaTaskId: taskId,
      })
    })
    .catch((error) => {
      input.context.mediaTasks?.updateMediaTask?.(taskId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Music generation failed',
        updatedAt: new Date().toISOString(),
      })
    })

  return {
    ok: true,
    output: {
      type: 'music',
      status: 'processing',
      taskId,
    },
    chatParts: [
      { type: 'music', status: 'processing', taskId },
    ],
  }
}

export function registerStarAgentTools(registry: AgentToolRegistry, context: StarAgentToolContext) {
  registry.register({
    name: 'star.speakReply',
    title: '语音回复',
    description: 'Present the current reply as speech.',
    category: 'reply',
    behavior: 'present_reply',
    capabilities: ['text_to_speech'],
    aliases: ['读给我听', '语音回复', '念给我听'],
    whenToUse: '用户明确要求把本轮回复读出来或用语音回复。',
    cannotDo: '不是唱歌工具，不生成歌曲或配乐。',
    outputTypes: ['audio'],
    inputSchema: { text: 'string' },
    riskLevel: 'low',
    approvalRequired: false,
    execute: input => runToolResult(async () => {
      const speak = requireContextValue(context.reply?.speak, 'Missing reply speaker')
      const text = readStringField(input, 'text')
      const output = await speak(text)
      const chatPart = output.url
        ? { type: 'audio' as const, url: output.url }
        : output.base64
        ? { type: 'audio' as const, base64: output.base64 }
        : undefined

      return {
        ok: true,
        output: {
          type: 'audio',
          status: 'created',
          ...(output.url && !isDataUrl(output.url) ? { url: output.url } : {}),
        },
        ...(chatPart ? { chatParts: [chatPart] } : {}),
      }
    }),
  })

  registry.register({
    name: 'star.searchMemories',
    title: '搜索记忆',
    description: 'Search sanitized star memory summaries.',
    category: 'memory',
    behavior: 'retrieve',
    capabilities: ['search_memory'],
    aliases: ['查记忆', '搜索记忆', '回忆'],
    whenToUse: '用户需要查找过往记忆，或需要先定位记忆 id 再治理记忆。',
    outputTypes: ['text'],
    inputSchema: { query: 'string', limit: 'number' },
    riskLevel: 'low',
    approvalRequired: false,
    execute: input => runTool(() => {
      const keyId = requireContextValue(context.keyId, 'Missing key id')
      const memorySearch = requireContextValue(context.memorySearch, 'Missing memory search')
      const query = readStringField(input, 'query')
      const limit = readOptionalLimit(input)

      return {
        memories: memorySearch.search(keyId, query, limit).map(memory => ({
          id: memory.id,
          content: memory.content,
          ...(memory.status ? { status: memory.status } : {}),
        })),
      }
    }),
  })

  registry.register({
    name: 'star.searchWorks',
    title: '搜索作品',
    description: 'Search sanitized star work summaries.',
    category: 'publish',
    behavior: 'retrieve',
    capabilities: ['search_work'],
    aliases: ['查作品', '搜索作品', '找作品'],
    whenToUse: '用户需要查找已有作品，或需要先定位作品 id 再发布作品。',
    outputTypes: ['text'],
    inputSchema: { query: 'string', limit: 'number' },
    riskLevel: 'low',
    approvalRequired: false,
    execute: input => runTool(() => {
      const keyId = requireContextValue(context.keyId, 'Missing key id')
      const workSearch = requireContextValue(context.workSearch, 'Missing work search')
      const query = readStringField(input, 'query')
      const limit = readOptionalLimit(input)

      return {
        works: workSearch.search(keyId, query, limit).map(work => ({
          id: work.id,
          type: work.type,
          title: work.title,
          summary: work.summary,
        })),
      }
    }),
  })

  registry.register({
    name: 'star.previewDesign',
    title: '预览设计',
    description: 'Preview a star page design change.',
    category: 'design',
    behavior: 'mutate',
    capabilities: ['preview_design'],
    aliases: ['预览设计', '改页面', '设计草稿'],
    whenToUse: '用户要求预览页面设计变更，或确认了设计修改建议。',
    outputTypes: ['status'],
    inputSchema: { instruction: 'string' },
    riskLevel: 'high',
    approvalRequired: true,
    execute: input => runTool(() => {
      const provider = requireContextValue(context.provider, 'Missing design provider')

      return provider.generateDesignPatch(input as never)
    }),
  })

  registry.register({
    name: 'star.commitDesign',
    title: '提交设计',
    description: 'Commit a star page design change.',
    category: 'design',
    behavior: 'mutate',
    capabilities: ['commit_design'],
    aliases: ['提交设计', '应用设计', '保存页面'],
    whenToUse: '用户明确要求应用已预览的页面设计变更。',
    outputTypes: ['status'],
    inputSchema: { version: 'number' },
    riskLevel: 'high',
    approvalRequired: true,
    execute: input => runTool(() => {
      const commitDesign = requireContextValue(context.commitDesign, 'Missing design committer')

      return commitDesign(input)
    }),
  })

  registry.register({
    name: 'star.sleep',
    title: '睡眠整理',
    description: 'Run star agent sleep consolidation.',
    category: 'system',
    behavior: 'mutate',
    capabilities: ['sleep_review'],
    aliases: ['整理记忆', '睡眠', '复盘', '沉淀'],
    whenToUse: '当用户要求整理记忆、复盘对话、沉淀长期偏好或触发睡眠整理时使用。',
    outputTypes: ['status'],
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    riskLevel: 'medium',
    approvalRequired: false,
    execute: input => runTool(() => {
      const sleep = requireContextValue(context.sleep, 'Missing sleep runner')

      return sleep(input)
    }),
  })

  registry.register({
    name: 'star.publishWork',
    title: '发布作品',
    description: 'Publish a private star work.',
    category: 'publish',
    behavior: 'publish',
    capabilities: ['publish_work'],
    aliases: ['发布', '公开', '展示作品'],
    whenToUse: '用户明确要求把已有私密作品发布为公开作品。',
    outputTypes: ['status'],
    inputSchema: { workId: 'string' },
    riskLevel: 'high',
    approvalRequired: true,
    execute: input => runTool(() => {
      const keyId = requireContextValue(context.keyId, 'Missing key id')
      const now = requireContextValue(context.now, 'Missing timestamp')
      const works = requireContextValue(context.works, 'Missing work repository')
      const workId = readStringField(input, 'workId')
      const work = works.getWorkByKey(keyId, workId)

      if (!work) {
        throw new Error('Work not found')
      }

      works.updateWorkVisibility(keyId, work.id, 'public', now)

      return {
        id: work.id,
        visibility: 'public',
      }
    }),
  })

  registry.register({
    name: 'star.governMemory',
    title: '治理记忆',
    description: 'Apply memory governance.',
    category: 'memory',
    behavior: 'mutate',
    capabilities: ['govern_memory'],
    aliases: ['整理记忆', '删除记忆', '归档记忆', '调整记忆'],
    whenToUse: '用户明确要求确认、降级、归档、拒绝或删除某条记忆。',
    outputTypes: ['status'],
    inputSchema: { memoryId: 'string', action: 'string', reason: 'string' },
    riskLevel: 'medium',
    approvalRequired: true,
    execute: input => runTool(() => {
      const keyId = requireContextValue(context.keyId, 'Missing key id')
      const now = requireContextValue(context.now, 'Missing timestamp')
      const memories = requireContextValue(context.memories, 'Missing memory repository')
      const memoryEvents = requireContextValue(context.memoryEvents, 'Missing memory event repository')
      const memoryId = readStringField(input, 'memoryId')
      const action = readMemoryAction(input)
      const reason = input && typeof input === 'object' && !Array.isArray(input) && typeof (input as { reason?: unknown }).reason === 'string'
        ? (input as { reason: string }).reason
        : ''
      const memory = memories.getMemoryByKey(keyId, memoryId)

      if (!memory) {
        throw new Error('Memory not found')
      }

      const beforeJson = JSON.stringify({
        importance: memory.importance,
        status: memory.status ?? 'active',
      })
      const nextMemory = { ...memory }

      if (action === 'confirm') {
        nextMemory.status = 'active'
        memories.updateMemory(memory.id, { status: 'active', updatedAt: now })
      }
      else if (action === 'downgrade') {
        nextMemory.importance = Math.max(0, memory.importance - 0.2)
        memories.updateMemory(memory.id, { importance: nextMemory.importance, updatedAt: now })
      }
      else if (action === 'archive') {
        nextMemory.status = 'archived'
        memories.updateMemory(memory.id, { status: 'archived', updatedAt: now })
      }
      else if (action === 'reject') {
        nextMemory.status = 'rejected'
        memories.updateMemory(memory.id, { status: 'rejected', updatedAt: now })
      }
      else if (action === 'delete') {
        const deleted = memories.deleteMemoryByKey(keyId, memory.id)

        if (deleted < 1) {
          throw new Error('Memory deletion failed')
        }
      }

      memoryEvents.addMemoryEvent({
        id: `memory_event_${memory.id}_${now}`,
        keyId,
        memoryId,
        action,
        beforeJson,
        afterJson: JSON.stringify({
          importance: nextMemory.importance,
          status: nextMemory.status ?? 'active',
          ...(action === 'delete' ? { deleted: true } : {}),
        }),
        reason,
        createdAt: now,
      })

      return {
        id: memoryId,
        status: action === 'delete' ? 'deleted' : nextMemory.status ?? 'active',
        importance: nextMemory.importance,
      }
    }),
  })

  registry.register({
    name: 'star.generateImage',
    title: '生成图片',
    description: 'Generate an image artifact.',
    category: 'media',
    behavior: 'create',
    capabilities: ['generate_image'],
    aliases: ['画一张', '图片', '插画', '海报'],
    whenToUse: '用户明确要求生成静态画面，或确认了图片生成建议。',
    outputTypes: ['image'],
    inputSchema: { prompt: 'string' },
    riskLevel: 'medium',
    approvalRequired: false,
    execute: input => runToolResult(() => {
      const media = requireContextValue(context.media?.generateImage, 'Missing image generator')

      const prompt = readStringField(input, 'prompt')
      return runMediaTool({ context, type: 'image', prompt, generate: media })
    }),
  })

  registry.register({
    name: 'star.generateMusic',
    title: '生成音乐',
    description: 'Generate a music artifact.',
    category: 'media',
    behavior: 'create',
    capabilities: ['generate_music', 'generate_song'],
    aliases: ['音乐', '写首歌', '唱首歌', '听一首歌', '想听歌', '制作音乐', '配乐', '生成音乐'],
    whenToUse: '用户明确要求生成音乐、歌曲、配乐，或表达想听一首歌时使用。',
    outputTypes: ['music'],
    inputSchema: { prompt: 'string' },
    riskLevel: 'medium',
    approvalRequired: false,
    execute: input => runToolResult(async () => {
      const media = requireContextValue(context.media?.generateMusic, 'Missing music generator')

      const prompt = readStringField(input, 'prompt')
      return runAsyncMusicTool({ context, prompt, generate: media })
    }),
  })

  registry.register({
    name: 'star.generateVideo',
    title: '生成视频',
    description: 'Generate a video artifact.',
    category: 'media',
    behavior: 'create',
    capabilities: ['generate_video'],
    aliases: ['视频', '短片', '生成视频'],
    whenToUse: '用户明确要求生成动态视频或短片。',
    outputTypes: ['video'],
    inputSchema: { prompt: 'string' },
    riskLevel: 'medium',
    approvalRequired: false,
    execute: input => runToolResult(() => {
      const media = requireContextValue(context.media?.createVideoTask, 'Missing video generator')

      const prompt = readStringField(input, 'prompt')
      return runMediaTool({ context, type: 'video', prompt, generate: media })
    }),
  })
}
