import { nanoid } from 'nanoid'
import { createError } from 'h3'
import type {
  AgentEventRecord,
  AgentEvolutionProposalRecord,
  AgentReflectionRecord,
  AgentSleepRunRecord,
  AgentStateRecord,
  AgentTaskRecord,
  ConversationRecord,
  KeyProfileRecord,
  MemoryRecord,
} from '../db/sqlite'
import { buildAgentSleepMessages, calculateNextSleepAt, parseAgentSleepResult } from './agent-learning'
import { buildOrganizingReportEvent, type OrganizingReport } from './agent-events'
import {
  completeAgentTask,
  enqueueAgentTask,
  failAgentTask,
  startAgentTask,
} from './agent-task-queue'

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
  agentState: Pick<AgentStateRecord, 'tone' | 'relationshipRole'>
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

function formatMemoryAction(action: { memoryId: string, action: string, reason: string }) {
  return `${action.memoryId}：${action.reason}`
}

export function buildAgentOrganizingReport(input: ReturnType<typeof parseAgentSleepResult>): OrganizingReport {
  return {
    title: '整理报告',
    summary: input.dailySummary,
    sections: [
      {
        type: 'new_memory',
        title: '新记忆',
        items: input.memoryActions.filter(action => action.action === 'confirm').map(formatMemoryAction),
      },
      {
        type: 'merge',
        title: '合并建议',
        items: input.memoryActions.filter(action => action.action === 'downgrade').map(formatMemoryAction),
      },
      {
        type: 'deletion',
        title: '删除建议',
        items: input.memoryActions.filter(action => action.action === 'archive' || action.action === 'reject').map(formatMemoryAction),
      },
      {
        type: 'action',
        title: '行动建议',
        items: input.proposals.map(proposal => `${proposal.title}：${proposal.summary}`),
      },
      {
        type: 'work',
        title: '作品建议',
        items: input.workIdeas.map(workIdea => `${workIdea.title}：${workIdea.summary}`),
      },
    ],
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
      title: '整理报告',
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
    const memories = input.memories
      .listMemoriesByKey(input.keyId)
      .filter(memory => (memory.status ?? 'active') !== 'rejected')
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
    const organizingReport = buildAgentOrganizingReport(parsed)

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
    if (hasAgentOs && input.agent && input.events) {
      input.events.addEvent(buildOrganizingReportEvent({
        id: `event_${nanoid()}`,
        agentId: input.agent.id,
        sleepRunId: runId,
        report: organizingReport,
        createdAt: input.now,
      }))
    }
    if (hasAgentOs && input.tasks && input.events && task) {
      completeAgentTask({
        task,
        result: {
          dailySummary: parsed.dailySummary,
          organizingReport,
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
      organizingReport,
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
