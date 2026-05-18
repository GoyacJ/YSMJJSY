import { createError, defineEventHandler, getRouterParam } from 'h3'
import {
  createAgentEventRepository,
  createAgentInstanceRepository,
  createAgentObservationRepository,
  createMediaTaskRepository,
} from '../../../db/sqlite'
import { withMiniMaxErrorBoundary } from '../../../services/api-errors'
import { createMiniMaxClient } from '../../../services/minimax'
import { recordMediaObservation } from '../tasks.post'

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

  const now = new Date().toISOString()

  repo.updateMediaTask(id, {
    status: status.status,
    resultUrl: status.url,
    updatedAt: now,
  })

  if (status.status === 'succeeded') {
    try {
      const agent = createAgentInstanceRepository(config.sqlitePath).getOrCreateAgentForOwner({
        ownerType: 'key',
        ownerId: keyId,
        domain: 'star',
        now,
      })

      recordMediaObservation({
        agentId: agent.id,
        taskId: id,
        mediaType: 'video',
        summary: '视频生成任务已完成。',
        now,
        observations: createAgentObservationRepository(config.sqlitePath),
        events: createAgentEventRepository(config.sqlitePath),
      })
    }
    catch {
      // Observation capture is secondary.
    }
  }

  return status
})
