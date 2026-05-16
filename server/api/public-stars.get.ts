import { defineEventHandler, getQuery } from 'h3'
import { createKeyProfileRepository, type PublicStarRecord } from '../db/sqlite'

export type PublicStarResponseItem = {
  id: string
  name: string
  mbti: string
  createdAt: string
  activityAt?: string | null
  activityKind?: PublicStarRecord['activityKind']
}

export function mapPublicStar(record: PublicStarRecord): PublicStarResponseItem {
  return {
    id: record.id,
    name: record.name,
    mbti: record.mbti,
    createdAt: record.createdAt,
    activityAt: record.activityAt ?? null,
    activityKind: record.activityKind ?? null,
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

  return {
    stars: stars.map(mapPublicStar),
  }
})
