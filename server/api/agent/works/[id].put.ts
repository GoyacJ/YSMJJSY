import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { createAgentWorkRepository, type AgentWorkRecord, type AgentWorkVisibility } from '../../../db/sqlite'
import { createAgentToolRegistry, type AgentToolRegistry } from '../../../services/agent-runtime'
import { registerStarAgentTools } from '../../../services/star-agent-tools'
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

export async function publishWorkWithTool(input: {
  toolName: 'star.publishWork'
  workId: string
  registry: Pick<AgentToolRegistry, 'execute'>
}) {
  const result = await input.registry.execute(input.toolName, { workId: input.workId })

  if (!result.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: result.error ?? 'Work publishing failed',
    })
  }

  return result.output as { id: string, visibility: AgentWorkVisibility }
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
  const visibility = parseWorkVisibilityBody(await readBody(event))
  const now = new Date().toISOString()

  if (visibility === 'public') {
    const works = createAgentWorkRepository(config.sqlitePath)
    const registry = createAgentToolRegistry()

    registerStarAgentTools(registry, {
      keyId,
      now,
      works,
    })

    return publishWorkWithTool({
      toolName: 'star.publishWork',
      workId,
      registry,
    })
  }

  return updateAgentWorkVisibilityAction({
    keyId,
    workId,
    visibility,
    now,
    works: createAgentWorkRepository(config.sqlitePath),
  })
})
