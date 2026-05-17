import { createError, defineEventHandler } from 'h3'
import {
  createConversationRepository,
  createAgentEvolutionRepository,
  createAgentReflectionRepository,
  createAgentSleepRepository,
  createAgentSnapshotRepository,
  createAgentStateRepository,
  createKeyProfileRepository,
  createMemoryEventRepository,
  createMemoryRepository,
  type AgentEvolutionProposalRecord,
  type AgentReflectionRecord,
  type AgentSleepRunRecord,
  type AgentStateSnapshotRecord,
  type AgentStateRecord,
  type ConversationRecord,
  type KeyProfileRecord,
  type MemoryEventRecord,
  type MemoryRecord,
} from '../../db/sqlite'

type AgentCoreInput = {
  profile: KeyProfileRecord
  agentState: AgentStateRecord
  memories: MemoryRecord[]
  sourceConversations?: ConversationRecord[]
  memoryEvents?: MemoryEventRecord[]
  reflections: AgentReflectionRecord[]
  proposals: AgentEvolutionProposalRecord[]
  snapshots?: AgentStateSnapshotRecord[]
  latestSleepRun?: AgentSleepRunRecord
}

export function requireAgentKey(event: { context: { keyId?: string } }) {
  const keyId = event.context.keyId

  if (!keyId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  return keyId
}

function parsePayload(payloadJson: string) {
  try {
    const parsed = JSON.parse(payloadJson)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  }
  catch {
    return {}
  }
}

function parseJsonArray(value?: string | null) {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  }
  catch {
    return []
  }
}

function serializeProposal(proposal: AgentEvolutionProposalRecord) {
  return {
    id: proposal.id,
    type: proposal.type,
    title: proposal.title,
    summary: proposal.summary,
    payload: parsePayload(proposal.payloadJson),
    status: proposal.status,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
  }
}

function isSleepReady(nextSleepAt?: string | null) {
  return !nextSleepAt || Date.now() >= Date.parse(nextSleepAt)
}

function buildSourceExcerpt(conversation?: ConversationRecord) {
  if (!conversation?.content) {
    return ''
  }

  return conversation.content.length > 90
    ? `${conversation.content.slice(0, 90)}...`
    : conversation.content
}

export function buildAgentCoreResponse(input: AgentCoreInput) {
  const sourceConversationById = new Map((input.sourceConversations ?? []).map(conversation => [conversation.id, conversation]))
  const memoryEventsByMemoryId = new Map<string, MemoryEventRecord[]>()

  for (const event of input.memoryEvents ?? []) {
    memoryEventsByMemoryId.set(event.memoryId, [
      ...(memoryEventsByMemoryId.get(event.memoryId) ?? []),
      event,
    ])
  }
  const memoryCounts = input.memories.reduce((counts, memory) => {
    const status = memory.status ?? 'active'
    counts.total += 1

    if (status === 'active' || status === 'archived' || status === 'rejected') {
      counts[status] += 1
    }

    return counts
  }, {
    total: 0,
    active: 0,
    archived: 0,
    rejected: 0,
  })

  return {
    profile: {
      keyId: input.profile.id,
      assistantName: input.profile.assistantName,
      mbti: input.profile.mbti,
      configured: Boolean(input.profile.configuredAt),
      tone: input.agentState.tone,
      relationshipRole: input.agentState.relationshipRole,
      learningMode: input.agentState.learningMode,
      contentStrategy: input.agentState.contentStrategy,
    },
    memoryCounts,
    memories: input.memories
      .filter(memory => (memory.status ?? 'active') === 'active')
      .map(memory => ({
        id: memory.id,
        type: memory.type,
        content: memory.content,
        importance: memory.importance,
        confidence: memory.confidence ?? 1,
        status: memory.status ?? 'active',
        sourceConversationId: memory.sourceConversationId ?? null,
        sourceAttachmentId: memory.sourceAttachmentId ?? null,
        sourceExcerpt: buildSourceExcerpt(
          memory.sourceConversationId
            ? sourceConversationById.get(memory.sourceConversationId)
            : undefined,
        ),
        governanceEvents: (memoryEventsByMemoryId.get(memory.id) ?? []).map(event => ({
          id: event.id,
          action: event.action,
          reason: event.reason,
          createdAt: event.createdAt,
        })),
        createdAt: memory.createdAt,
      })),
    latestReflections: input.reflections.map(reflection => ({
      id: reflection.id,
      summary: reflection.summary,
      createdAt: reflection.createdAt,
    })),
    proposals: {
      pending: input.proposals
        .filter(proposal => proposal.status === 'pending')
        .map(serializeProposal),
      history: input.proposals
        .filter(proposal => proposal.status !== 'pending')
        .map(serializeProposal),
    },
    snapshots: (input.snapshots ?? []).map(snapshot => ({
      id: snapshot.id,
      proposalId: snapshot.proposalId ?? null,
      createdAt: snapshot.createdAt,
    })),
    sleep: {
      lastSleepAt: input.agentState.lastSleepAt ?? null,
      nextSleepAt: input.agentState.nextSleepAt ?? null,
      ready: isSleepReady(input.agentState.nextSleepAt),
      latestRun: input.latestSleepRun
        ? {
            id: input.latestSleepRun.id,
            status: input.latestSleepRun.status,
            summary: input.latestSleepRun.summary,
            memoryActions: parseJsonArray(input.latestSleepRun.memoryActionsJson),
            workIdeas: parseJsonArray(input.latestSleepRun.workIdeasJson),
            nextConversationHints: parseJsonArray(input.latestSleepRun.nextConversationHintsJson),
            startedAt: input.latestSleepRun.startedAt,
            completedAt: input.latestSleepRun.completedAt,
            error: input.latestSleepRun.error,
          }
        : null,
    },
  }
}

export default defineEventHandler((event) => {
  const keyId = requireAgentKey(event)
  const config = useRuntimeConfig(event)
  const profile = createKeyProfileRepository(config.sqlitePath).getKeyProfile(keyId)

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Profile not found',
    })
  }

  const memories = createMemoryRepository(config.sqlitePath).listMemoriesByKey(keyId)
  const conversations = createConversationRepository(config.sqlitePath)
  const sourceConversations = memories
    .map(memory => memory.sourceConversationId ? conversations.getConversationByKey(keyId, memory.sourceConversationId) : undefined)
    .filter((conversation): conversation is ConversationRecord => Boolean(conversation))

  return buildAgentCoreResponse({
    profile,
    agentState: createAgentStateRepository(config.sqlitePath).getOrCreateAgentState(keyId, new Date().toISOString()),
    memories,
    sourceConversations,
    memoryEvents: createMemoryEventRepository(config.sqlitePath).listMemoryEventsByKey(keyId),
    reflections: createAgentReflectionRepository(config.sqlitePath).listReflectionsByKey(keyId, 5),
    proposals: createAgentEvolutionRepository(config.sqlitePath).listProposalsByKey(keyId),
    snapshots: createAgentSnapshotRepository(config.sqlitePath).listSnapshotsByKey(keyId, 12),
    latestSleepRun: createAgentSleepRepository(config.sqlitePath).getLatestSleepRunByKey(keyId),
  })
})
