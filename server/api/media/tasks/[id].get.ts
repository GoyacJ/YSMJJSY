import { createError, defineEventHandler, getRouterParam } from 'h3'
import { createMediaTaskRepository, type MediaTaskRecord } from '../../../db/sqlite'
import { requireAgentKey } from '../../agent/core.get'

type MediaTaskRepository = {
  getMediaTaskByKey: (keyId: string, id: string) => MediaTaskRecord | undefined
}

function serializeMediaTask(task: MediaTaskRecord) {
  return {
    id: task.id,
    type: task.type,
    providerTaskId: task.providerTaskId ?? null,
    status: task.status,
    resultUrl: task.resultUrl ?? null,
    error: task.error ?? null,
    updatedAt: task.updatedAt,
  }
}

export function buildMediaTaskResponse(input: {
  keyId: string
  taskId: string
  mediaTasks: MediaTaskRepository
}) {
  const task = input.mediaTasks.getMediaTaskByKey(input.keyId, input.taskId)

  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Media task not found' })
  }

  return {
    task: serializeMediaTask(task),
  }
}

export default defineEventHandler((event) => {
  const keyId = requireAgentKey(event)
  const taskId = getRouterParam(event, 'id')

  if (!taskId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing media task id' })
  }

  const config = useRuntimeConfig(event)

  return buildMediaTaskResponse({
    keyId,
    taskId,
    mediaTasks: createMediaTaskRepository(config.sqlitePath),
  })
})
