import { createError, defineEventHandler, getRouterParam } from 'h3'
import { createMediaTaskRepository } from '../../../db/sqlite'
import { withMiniMaxErrorBoundary } from '../../../services/api-errors'
import { createMiniMaxClient } from '../../../services/minimax'

export default defineEventHandler(async (event) => {
  const keyId = event.context.keyId
  const id = getRouterParam(event, 'id')

  if (!keyId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing task id' })
  }

  const config = useRuntimeConfig(event)
  const repo = createMediaTaskRepository(config.sqlitePath)
  const task = repo.getMediaTaskByKey(keyId, id)

  if (!task || task.type !== 'video') {
    throw createError({ statusCode: 404, statusMessage: 'Video task not found' })
  }

  if (task.status === 'succeeded' || task.status === 'failed' || !task.providerTaskId) {
    return {
      status: task.status,
      url: task.resultUrl ?? undefined,
      error: task.error ?? undefined,
    }
  }

  const client = createMiniMaxClient({
    apiKey: config.minimaxApiKey,
    groupId: config.minimaxGroupId,
  })
  const status = await withMiniMaxErrorBoundary(() => client.getVideoTask(task.providerTaskId), 'Video task query failed')

  repo.updateMediaTask(id, {
    status: status.status,
    resultUrl: status.url,
    updatedAt: new Date().toISOString(),
  })

  return status
})
