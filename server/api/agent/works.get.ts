import { createError, defineEventHandler } from 'h3'
import { createAgentWorkRepository, type AgentWorkRecord } from '../../db/sqlite'
import { requireAgentKey } from './core.get'

function parsePayload(payloadJson: string) {
  try {
    const parsed = JSON.parse(payloadJson)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  }
  catch {
    return {}
  }
}

export function buildAgentWorksResponse(input: {
  keyId: string
  works: { listWorksByKey: (keyId: string) => AgentWorkRecord[] }
}) {
  return {
    works: input.works.listWorksByKey(input.keyId).map(work => ({
      id: work.id,
      type: work.type,
      title: work.title,
      summary: work.summary,
      previewUrl: work.previewUrl ?? null,
      visibility: work.visibility,
      sourceConversationId: work.sourceConversationId ?? null,
      sourceDesignVersion: work.sourceDesignVersion ?? null,
      payload: parsePayload(work.payloadJson),
      createdAt: work.createdAt,
      updatedAt: work.updatedAt,
    })),
  }
}

export default defineEventHandler((event) => {
  const keyId = requireAgentKey(event)
  const config = useRuntimeConfig(event)

  if (!keyId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  return buildAgentWorksResponse({
    keyId,
    works: createAgentWorkRepository(config.sqlitePath),
  })
})
