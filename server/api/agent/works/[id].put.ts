import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { createAgentWorkRepository, type AgentWorkRecord, type AgentWorkVisibility } from '../../../db/sqlite'
import { requireAgentKey } from '../core.get'

export function updateAgentWorkVisibilityAction(input: {
  keyId: string
  workId: string
  visibility: AgentWorkVisibility
  now: string
  works: {
    getWorkByKey: (keyId: string, id: string) => AgentWorkRecord | undefined
    updateWorkVisibility: (keyId: string, id: string, visibility: AgentWorkVisibility, updatedAt: string) => void
  }
}) {
  const work = input.works.getWorkByKey(input.keyId, input.workId)

  if (!work) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Work not found',
    })
  }

  input.works.updateWorkVisibility(input.keyId, input.workId, input.visibility, input.now)

  return {
    id: input.workId,
    visibility: input.visibility,
  }
}

function parseWorkVisibilityBody(body: unknown): AgentWorkVisibility {
  if (body && typeof body === 'object') {
    const visibility = (body as { visibility?: unknown }).visibility

    if (visibility === 'private' || visibility === 'public') {
      return visibility
    }
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Invalid work visibility',
  })
}

export default defineEventHandler(async (event) => {
  const keyId = requireAgentKey(event)
  const workId = getRouterParam(event, 'id')

  if (!workId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing work id',
    })
  }

  const config = useRuntimeConfig(event)

  return updateAgentWorkVisibilityAction({
    keyId,
    workId,
    visibility: parseWorkVisibilityBody(await readBody(event)),
    now: new Date().toISOString(),
    works: createAgentWorkRepository(config.sqlitePath),
  })
})
