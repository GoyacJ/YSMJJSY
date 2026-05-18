import { nanoid } from 'nanoid'
import { createError, defineEventHandler } from 'h3'
import {
  createAgentEventRepository,
  createAgentEvolutionRepository,
  createAgentInstanceRepository,
  createAgentReflectionRepository,
  createAgentSleepRepository,
  createAgentStateRepository,
  createAgentTaskRepository,
  createConversationRepository,
  createKeyProfileRepository,
  createMemoryRepository,
  type AgentEventRecord,
  type AgentEvolutionProposalRecord,
  type AgentReflectionRecord,
  type AgentSleepRunRecord,
  type AgentStateRecord,
  type AgentTaskRecord,
  type ConversationRecord,
  type KeyProfileRecord,
  type MemoryRecord,
} from '../../db/sqlite'
import { buildAgentSleepMessages, calculateNextSleepAt, parseAgentSleepResult } from '../../services/agent-learning'
import { createDefaultAgentProviderRegistry } from '../../services/agent-providers'
import {
  completeAgentTask,
  enqueueAgentTask,
  failAgentTask,
  startAgentTask,
} from '../../services/agent-task-queue'
import { requireAgentKey } from './core.get'

export type ManualAgentSleepInput = {
  keyId: string
  now: string
  agent?: {
    id: string
  }
  client: {
    reflect?: (messages: ReturnType<typeof buildAgentSleepMessages>) => Promise<string>
    reflectAgent?: (messages: ReturnType<typeof buildAgentSleepMessages>) => Promise<string>
  }
  profile: Pick<KeyProfileRecord, 'assistantName' | 'mbti'>
  agentState: AgentStateRecord
  memories: {
    listMemoriesByKey: (keyId: string) => MemoryRecord[]
  }
  conversations: {
    listRecentConversationsByKey: (keyId: string, limit?: number) => ConversationRecord[]
  }
  reflections: {
    listReflectionsByKey: (keyId: string, limit?: number) => AgentReflectionRecord[]
    addReflection: (record: AgentReflectionRecord) => void
  }
  proposals: {
    addProposal: (record: AgentEvolutionProposalRecord) => void
  }
  sleeps: {
    addSleepRun: (record: AgentSleepRunRecord) => void
    updateSleepRun: (id: string, updates: Partial<Pick<AgentSleepRunRecord, 'status' | 'summary' | 'rawJson' | 'memoryActionsJson' | 'workIdeasJson' | 'nextConversationHintsJson' | 'completedAt' | 'error'>>) => void
  }
  states: {
    updateAgentState: (keyId: string, updates: Partial<Omit<AgentStateRecord, 'keyId'>> & { updatedAt: string }) => void
  }
  tasks?: {
    addTask: (record: AgentTaskRecord) => void
    updateTask: (id: string, updates: Partial<Pick<AgentTaskRecord, 'status' | 'resultJson' | 'error' | 'updatedAt'>>) => void
  }
  events?: {
    addEvent: (record: AgentEventRecord) => void
  }
}

export async function runManualAgentSleep(input: ManualAgentSleepInput) {
  const runId = nanoid()
  const reflectionId = nanoid()
  const hasAgentOs = Boolean(input.agent && input.tasks && input.events)
  let task: AgentTaskRecord | undefined

  input.sleeps.addSleepRun({
    id: runId,
    keyId: input.keyId,
    status: 'running',
    summary: '',
    rawJson: '',
    startedAt: input.now,
    completedAt: null,
    error: null,
  })

  if (hasAgentOs && input.agent && input.tasks && input.events) {
    task = enqueueAgentTask({
      agentId: input.agent.id,
      type: 'sleep',
      title: '睡眠整理',
      summary: '整理最近记忆、反思和提案。',
      input: { keyId: input.keyId, runId },
      now: input.now,
      tasks: input.tasks,
      events: input.events,
    })
    startAgentTask({
      task,
      now: input.now,
      tasks: input.tasks,
      events: input.events,
    })
  }

  try {
    const memories = input.memories.listMemoriesByKey(input.keyId)
    const reflections = input.reflections.listReflectionsByKey(input.keyId, 8)
    const recentConversation = input.conversations.listRecentConversationsByKey(input.keyId, 12)
    const messages = buildAgentSleepMessages({
      profile: {
        assistantName: input.profile.assistantName,
        mbti: input.profile.mbti,
        tone: input.agentState.tone,
        relationshipRole: input.agentState.relationshipRole,
      },
      memories: memories.map(memory => ({
        id: memory.id,
        content: memory.content,
        importance: memory.importance,
        confidence: memory.confidence ?? 1,
      })),
      reflections: reflections.map(reflection => reflection.summary).filter(Boolean),
      recentConversation: recentConversation.map(item => `${item.role}: ${item.content}`),
    })
    const reflect = input.client.reflect ?? input.client.reflectAgent

    if (!reflect) {
      throw new Error('Agent sleep provider is missing')
    }

    const rawJson = await reflect(messages)
    const parsed = parseAgentSleepResult(rawJson)

    input.reflections.addReflection({
      id: reflectionId,
      keyId: input.keyId,
      conversationId: null,
      summary: parsed.dailySummary,
      rawJson,
      createdAt: input.now,
    })

    const createdProposals = parsed.proposals.map((proposal) => {
      const record: AgentEvolutionProposalRecord = {
        id: nanoid(),
        keyId: input.keyId,
        reflectionId,
        type: proposal.type,
        title: proposal.title,
        summary: proposal.summary,
        payloadJson: JSON.stringify(proposal.payload),
        status: 'pending',
        createdAt: input.now,
        updatedAt: input.now,
      }

      input.proposals.addProposal(record)
      return record
    })

    input.sleeps.updateSleepRun(runId, {
      status: 'completed',
      summary: parsed.dailySummary,
      rawJson,
      memoryActionsJson: JSON.stringify(parsed.memoryActions),
      workIdeasJson: JSON.stringify(parsed.workIdeas),
      nextConversationHintsJson: JSON.stringify(parsed.nextConversationHints),
      completedAt: input.now,
      error: null,
    })
    if (hasAgentOs && input.tasks && input.events && task) {
      completeAgentTask({
        task,
        result: {
          dailySummary: parsed.dailySummary,
          memoryActions: parsed.memoryActions,
          workIdeas: parsed.workIdeas,
          nextConversationHints: parsed.nextConversationHints,
          proposalIds: createdProposals.map(proposal => proposal.id),
        },
        summary: parsed.dailySummary,
        now: input.now,
        tasks: input.tasks,
        events: input.events,
      })
    }
    input.states.updateAgentState(input.keyId, {
      lastSleepAt: input.now,
      nextSleepAt: calculateNextSleepAt(input.now),
      updatedAt: input.now,
    })

    return {
      run: {
        id: runId,
        keyId: input.keyId,
        status: 'completed' as const,
        summary: parsed.dailySummary,
        rawJson,
        memoryActionsJson: JSON.stringify(parsed.memoryActions),
        workIdeasJson: JSON.stringify(parsed.workIdeas),
        nextConversationHintsJson: JSON.stringify(parsed.nextConversationHints),
        startedAt: input.now,
        completedAt: input.now,
        error: null,
      },
      proposals: createdProposals,
      memoryActions: parsed.memoryActions,
      workIdeas: parsed.workIdeas,
      nextConversationHints: parsed.nextConversationHints,
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Agent sleep failed'

    input.sleeps.updateSleepRun(runId, {
      status: 'failed',
      completedAt: input.now,
      error: message,
    })
    if (hasAgentOs && input.tasks && input.events && task) {
      failAgentTask({
        task,
        error: message,
        now: input.now,
        tasks: input.tasks,
        events: input.events,
      })
    }

    throw createError({
      statusCode: 502,
      statusMessage: 'Agent sleep failed',
    })
  }
}

export default defineEventHandler(async (event) => {
  const keyId = requireAgentKey(event)
  const config = useRuntimeConfig(event)
  const profile = createKeyProfileRepository(config.sqlitePath).getKeyProfile(keyId)

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Profile not found',
    })
  }

  const providerRegistry = createDefaultAgentProviderRegistry({
    minimaxApiKey: config.minimaxApiKey,
    minimaxGroupId: config.minimaxGroupId,
  })
  const client = providerRegistry.getDefault()
  const states = createAgentStateRepository(config.sqlitePath)
  const now = new Date().toISOString()
  const agent = createAgentInstanceRepository(config.sqlitePath).getOrCreateAgentForOwner({
    ownerType: 'key',
    ownerId: keyId,
    domain: 'star',
    now,
  })

  return runManualAgentSleep({
    keyId,
    now,
    agent,
    client,
    profile,
    agentState: states.getOrCreateAgentState(keyId, now),
    memories: createMemoryRepository(config.sqlitePath),
    conversations: createConversationRepository(config.sqlitePath),
    reflections: createAgentReflectionRepository(config.sqlitePath),
    proposals: createAgentEvolutionRepository(config.sqlitePath),
    sleeps: createAgentSleepRepository(config.sqlitePath),
    states,
    tasks: createAgentTaskRepository(config.sqlitePath),
    events: createAgentEventRepository(config.sqlitePath),
  })
})
