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
}

export function buildAgentTimeline(input: {
  profile: Pick<KeyProfileRecord, 'createdAt' | 'configuredAt'>
  memories: Array<Pick<MemoryRecord, 'id' | 'content' | 'createdAt'>>
  reflections: Array<Pick<AgentReflectionRecord, 'id' | 'summary' | 'createdAt'>>
  proposals: Array<Pick<AgentEvolutionProposalRecord, 'id' | 'title' | 'summary' | 'createdAt'>>
  sleepRuns: Array<Pick<AgentSleepRunRecord, 'id' | 'summary' | 'startedAt' | 'status'>>
  works: Array<Pick<AgentWorkRecord, 'id' | 'type' | 'title' | 'summary' | 'createdAt'>>
}): AgentTimelineItem[] {
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
    })
  }

  for (const proposal of input.proposals) {
    items.push({
      id: proposal.id,
      type: 'proposal',
      title: proposal.title,
      summary: proposal.summary,
      createdAt: proposal.createdAt,
    })
  }

  for (const work of input.works) {
    items.push({
      id: work.id,
      type: work.type === 'page_design' ? 'design' : 'work',
      title: work.title,
      summary: work.summary,
      createdAt: work.createdAt,
    })
  }

  items.push({
    id: 'key',
    type: 'key',
    title: '星球诞生',
    summary: '创建了这个 key。',
    createdAt: input.profile.createdAt,
  })

  const order: Record<AgentTimelineItem['type'], number> = {
    profile: 0,
    memory: 1,
    reflection: 2,
    sleep: 3,
    proposal: 4,
    work: 5,
    design: 6,
    key: 7,
  }

  return items.sort((a, b) => order[a.type] - order[b.type] || b.createdAt.localeCompare(a.createdAt))
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

  return {
    items: buildAgentTimeline({
      profile,
      memories: createMemoryRepository(config.sqlitePath).listMemoriesByKey(keyId),
      reflections: createAgentReflectionRepository(config.sqlitePath).listReflectionsByKey(keyId),
      proposals: createAgentEvolutionRepository(config.sqlitePath).listProposalsByKey(keyId),
      sleepRuns: createAgentSleepRepository(config.sqlitePath).listSleepRunsByKey(keyId),
      works: createAgentWorkRepository(config.sqlitePath).listWorksByKey(keyId),
    }),
  }
})
