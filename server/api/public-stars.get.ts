import { defineEventHandler, getQuery } from 'h3'
import { createAgentWorkRepository, createKeyProfileRepository, type AgentWorkType, type PublicStarRecord } from '../db/sqlite'

export type PublicStarResponseItem = {
  id: string
  name: string
  mbti: string
  createdAt: string
  activityAt?: string | null
  activityKind?: PublicStarRecord['activityKind']
  publicWorks: Array<{
    id: string
    type: AgentWorkType
    title: string
    summary: string
  }>
}

export function mapPublicStar(record: PublicStarRecord): PublicStarResponseItem {
  return {
    id: record.id,
    name: record.name,
    mbti: record.mbti,
    createdAt: record.createdAt,
    activityAt: record.activityAt ?? null,
    activityKind: record.activityKind ?? null,
    publicWorks: (record.publicWorks ?? []).map(work => ({
      id: work.id,
      type: work.type,
      title: work.title,
      summary: work.summary,
    })),
  }
}

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const query = getQuery(event)
  const requestedLimit = Number(query.limit)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 120)
    : 80
  const stars = createKeyProfileRepository(config.sqlitePath).listPublicStars(limit)
  const publicWorksByKey = new Map<string, PublicStarRecord['publicWorks']>()

  for (const work of createAgentWorkRepository(config.sqlitePath).listPublicWorks(limit * 4)) {
    const works = publicWorksByKey.get(work.keyId) ?? []
    works.push({
      id: work.id,
      type: work.type,
      title: work.title,
      summary: work.summary,
    })
    publicWorksByKey.set(work.keyId, works)
  }

  return {
    stars: stars.map(star => mapPublicStar({
      ...star,
      publicWorks: publicWorksByKey.get(star.id) ?? [],
    })),
  }
})
