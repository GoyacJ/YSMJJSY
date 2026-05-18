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

type StarAgentToolContext = {
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
    description: 'Preview a star page design change.',
    riskLevel: 'high',
    approvalRequired: true,
    execute: input => runTool(() => {
      const provider = requireContextValue(context.provider, 'Missing design provider')

      return provider.generateDesignPatch(input as never)
    }),
  })

  registry.register({
    name: 'star.commitDesign',
    description: 'Commit a star page design change.',
    riskLevel: 'high',
    approvalRequired: true,
    execute: input => runTool(() => input),
  })

  registry.register({
    name: 'star.publishWork',
    description: 'Publish a private star work.',
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
    description: 'Apply memory governance.',
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
    description: 'Generate an image artifact.',
    riskLevel: 'medium',
    approvalRequired: false,
    execute: input => runTool(() => {
      const media = requireContextValue(context.media?.generateImage, 'Missing image generator')

      return media(readStringField(input, 'prompt'))
    }),
  })

  registry.register({
    name: 'star.generateMusic',
    description: 'Generate a music artifact.',
    riskLevel: 'medium',
    approvalRequired: false,
    execute: input => runTool(() => {
      const media = requireContextValue(context.media?.generateMusic, 'Missing music generator')

      return media(readStringField(input, 'prompt'))
    }),
  })

  registry.register({
    name: 'star.generateVideo',
    description: 'Generate a video artifact.',
    riskLevel: 'medium',
    approvalRequired: false,
    execute: input => runTool(() => {
      const media = requireContextValue(context.media?.createVideoTask, 'Missing video generator')

      return media(readStringField(input, 'prompt'))
    }),
  })
}
