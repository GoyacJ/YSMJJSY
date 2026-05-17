import { nanoid } from 'nanoid'
import { createError, defineEventHandler } from 'h3'
import {
  createAgentEvolutionRepository,
  createAgentReflectionRepository,
  createAgentSleepRepository,
  createAgentStateRepository,
  createConversationRepository,
  createKeyProfileRepository,
  createMemoryRepository,
  type AgentEvolutionProposalRecord,
  type AgentReflectionRecord,
  type AgentSleepRunRecord,
  type AgentStateRecord,
  type ConversationRecord,
  type KeyProfileRecord,
  type MemoryRecord,
} from '../../db/sqlite'
import { buildAgentSleepMessages, parseAgentSleepResult } from '../../services/agent-learning'
import { createMiniMaxClient } from '../../services/minimax'
import { requireAgentKey } from './core.get'

export type ManualAgentSleepInput = {
  keyId: string
  now: string
  client: {
    reflectAgent: (messages: ReturnType<typeof buildAgentSleepMessages>) => Promise<string>
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
}

export async function runManualAgentSleep(input: ManualAgentSleepInput) {
  const runId = nanoid()
  const reflectionId = nanoid()

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
    const rawJson = await input.client.reflectAgent(messages)
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
    input.states.updateAgentState(input.keyId, {
      lastSleepAt: input.now,
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

  const client = createMiniMaxClient({
    apiKey: config.minimaxApiKey,
    groupId: config.minimaxGroupId,
  })
  const states = createAgentStateRepository(config.sqlitePath)
  const now = new Date().toISOString()

  return runManualAgentSleep({
    keyId,
    now,
    client,
    profile,
    agentState: states.getOrCreateAgentState(keyId, now),
    memories: createMemoryRepository(config.sqlitePath),
    conversations: createConversationRepository(config.sqlitePath),
    reflections: createAgentReflectionRepository(config.sqlitePath),
    proposals: createAgentEvolutionRepository(config.sqlitePath),
    sleeps: createAgentSleepRepository(config.sqlitePath),
    states,
  })
})
