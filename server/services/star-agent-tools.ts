import type {
  AgentToolRegistry,
  AgentToolResult,
  NamedAgentModelProvider,
} from './agent-runtime'
import type {
  AgentWorkRecord,
  AgentWorkVisibility,
  MemoryEventRecord,
  MemoryGovernanceAction,
  MemoryRecord,
} from '../db/sqlite'

export type StarAgentToolContext = {
  keyId?: string
  now?: string
  provider?: Pick<NamedAgentModelProvider, 'generateDesignPatch'>
  media?: {
    generateImage?: (prompt: string) => Promise<unknown>
    generateMusic?: (prompt: string) => Promise<unknown>
    createVideoTask?: (prompt: string) => Promise<unknown>
  }
  works?: {
    getWorkByKey: (keyId: string, id: string) => Pick<AgentWorkRecord, 'id' | 'visibility'> | undefined
    updateWorkVisibility: (keyId: string, id: string, visibility: AgentWorkVisibility, updatedAt: string) => void
  }
  memories?: {
    getMemoryByKey: (keyId: string, id: string) => MemoryRecord | undefined
    updateMemory: (id: string, updates: { importance?: number, status?: 'active' | 'archived' | 'rejected', updatedAt: string }) => void
  }
  memoryEvents?: {
    addMemoryEvent: (record: MemoryEventRecord) => void
  }
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

  if (action === 'confirm' || action === 'downgrade' || action === 'archive' || action === 'reject') {
    return action
  }

  throw new Error('Invalid memory action')
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

export function registerStarAgentTools(registry: AgentToolRegistry, context: StarAgentToolContext) {
  registry.register({
    name: 'star.previewDesign',
    title: '预览设计',
    description: 'Preview a star page design change.',
    category: 'design',
    behavior: 'mutate',
    aliases: ['预览设计', '改页面', '设计草稿'],
    whenToUse: '用户要求预览页面设计变更，或确认了设计修改建议。',
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
    aliases: ['提交设计', '应用设计', '保存页面'],
    whenToUse: '用户明确要求应用已预览的页面设计变更。',
    inputSchema: { version: 'number' },
    riskLevel: 'high',
    approvalRequired: true,
    execute: input => runTool(() => input),
  })

  registry.register({
    name: 'star.publishWork',
    title: '发布作品',
    description: 'Publish a private star work.',
    category: 'publish',
    behavior: 'publish',
    aliases: ['发布', '公开', '展示作品'],
    whenToUse: '用户明确要求把已有私密作品发布为公开作品。',
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
    aliases: ['整理记忆', '删除记忆', '归档记忆', '调整记忆'],
    whenToUse: '用户明确要求确认、降级、归档、拒绝或删除某条记忆。',
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

      if (action === 'downgrade') {
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

      memoryEvents.addMemoryEvent({
        id: `memory_event_${memory.id}_${now}`,
        keyId,
        memoryId,
        action,
        beforeJson,
        afterJson: JSON.stringify({
          importance: nextMemory.importance,
          status: nextMemory.status ?? 'active',
        }),
        reason,
        createdAt: now,
      })

      return {
        id: memoryId,
        status: nextMemory.status ?? 'active',
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
    aliases: ['画一张', '图片', '插画', '海报'],
    whenToUse: '用户明确要求生成静态画面，或确认了图片生成建议。',
    inputSchema: { prompt: 'string' },
    riskLevel: 'medium',
    approvalRequired: false,
    execute: input => runTool(() => {
      const media = requireContextValue(context.media?.generateImage, 'Missing image generator')

      return media(readStringField(input, 'prompt'))
    }),
  })

  registry.register({
    name: 'star.generateMusic',
    title: '生成音乐',
    description: 'Generate a music artifact.',
    category: 'media',
    behavior: 'create',
    aliases: ['音乐', '写首歌', '配乐', '生成音乐'],
    whenToUse: '用户明确要求生成音乐、歌曲或配乐。',
    inputSchema: { prompt: 'string' },
    riskLevel: 'medium',
    approvalRequired: false,
    execute: input => runTool(() => {
      const media = requireContextValue(context.media?.generateMusic, 'Missing music generator')

      return media(readStringField(input, 'prompt'))
    }),
  })

  registry.register({
    name: 'star.generateVideo',
    title: '生成视频',
    description: 'Generate a video artifact.',
    category: 'media',
    behavior: 'create',
    aliases: ['视频', '短片', '生成视频'],
    whenToUse: '用户明确要求生成动态视频或短片。',
    inputSchema: { prompt: 'string' },
    riskLevel: 'medium',
    approvalRequired: false,
    execute: input => runTool(() => {
      const media = requireContextValue(context.media?.createVideoTask, 'Missing video generator')

      return media(readStringField(input, 'prompt'))
    }),
  })
}
