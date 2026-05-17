import { createError, defineEventHandler } from 'h3'
import {
  createAgentEvolutionRepository,
  createAgentReflectionRepository,
  createAgentSleepRepository,
  createAgentWorkRepository,
  createKeyProfileRepository,
  createMemoryRepository,
  type AgentEvolutionProposalRecord,
  type AgentReflectionRecord,
  type AgentSleepRunRecord,
  type AgentWorkRecord,
  type KeyProfileRecord,
  type MemoryRecord,
} from '../../db/sqlite'
import { requireAgentKey } from './core.get'

export type AgentTimelineItem = {
  id: string
  type: 'key' | 'profile' | 'memory' | 'reflection' | 'sleep' | 'proposal' | 'work' | 'design'
  title: string
  summary: string
  createdAt: string
  targetId?: string
  targetType?: 'memory' | 'proposal' | 'sleep' | 'work' | 'design'
  importance?: 'normal' | 'high'
}

export function buildAgentTimeline(input: {
  profile: Pick<KeyProfileRecord, 'createdAt' | 'configuredAt'>
  memories: Array<Pick<MemoryRecord, 'id' | 'content' | 'importance' | 'createdAt'>>
  reflections: Array<Pick<AgentReflectionRecord, 'id' | 'summary' | 'createdAt'>>
  proposals: Array<Pick<AgentEvolutionProposalRecord, 'id' | 'title' | 'summary' | 'createdAt'>>
  sleepRuns: Array<Pick<AgentSleepRunRecord, 'id' | 'summary' | 'startedAt' | 'status'>>
  works: Array<Pick<AgentWorkRecord, 'id' | 'type' | 'title' | 'summary' | 'createdAt'>>
}) {
  const items: AgentTimelineItem[] = []

  if (input.profile.configuredAt) {
    items.push({
      id: 'profile',
      type: 'profile',
      title: '完成设定',
      summary: '智能体 profile 已配置。',
      createdAt: input.profile.configuredAt,
    })
  }

  for (const memory of input.memories) {
    items.push({
      id: memory.id,
      type: 'memory',
      title: '形成记忆',
      summary: memory.content,
      createdAt: memory.createdAt,
      targetId: memory.id,
      targetType: 'memory',
      importance: memory.importance >= 0.8 ? 'high' : 'normal',
    })
  }

  for (const reflection of input.reflections) {
    items.push({
      id: reflection.id,
      type: 'reflection',
      title: '完成反思',
      summary: reflection.summary,
      createdAt: reflection.createdAt,
    })
  }

  for (const run of input.sleepRuns) {
    items.push({
      id: run.id,
      type: 'sleep',
      title: run.status === 'completed' ? '睡眠整理' : '睡眠记录',
      summary: run.summary,
      createdAt: run.startedAt,
      targetId: run.id,
      targetType: 'sleep',
    })
  }

  for (const proposal of input.proposals) {
    items.push({
      id: proposal.id,
      type: 'proposal',
      title: proposal.title,
      summary: proposal.summary,
      createdAt: proposal.createdAt,
      targetId: proposal.id,
      targetType: 'proposal',
    })
  }

  for (const work of input.works) {
    const targetType = work.type === 'page_design' ? 'design' : 'work'

    items.push({
      id: work.id,
      type: targetType,
      title: work.title,
      summary: work.summary,
      createdAt: work.createdAt,
      targetId: work.id,
      targetType,
    })
  }

  items.push({
    id: 'key',
    type: 'key',
    title: '星球诞生',
    summary: '创建了这个 key。',
    createdAt: input.profile.createdAt,
  })

  const sortedItems = items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const groups = sortedItems.reduce<Array<{ date: string, items: AgentTimelineItem[] }>>((result, item) => {
    const date = item.createdAt.slice(0, 10)
    const group = result.find(existing => existing.date === date)

    if (group) {
      group.items.push(item)
    }
    else {
      result.push({ date, items: [item] })
    }

    return result
  }, [])

  return {
    items: sortedItems,
    groups,
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

  return buildAgentTimeline({
    profile,
    memories: createMemoryRepository(config.sqlitePath).listMemoriesByKey(keyId),
    reflections: createAgentReflectionRepository(config.sqlitePath).listReflectionsByKey(keyId),
    proposals: createAgentEvolutionRepository(config.sqlitePath).listProposalsByKey(keyId),
    sleepRuns: createAgentSleepRepository(config.sqlitePath).listSleepRunsByKey(keyId),
    works: createAgentWorkRepository(config.sqlitePath).listWorksByKey(keyId),
  })
})
