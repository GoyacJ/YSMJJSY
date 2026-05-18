import { nanoid } from 'nanoid'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import {
  createAgentEventRepository,
  createAgentInstanceRepository,
  createAgentObservationRepository,
  createMediaTaskRepository,
  type AgentEventRecord,
  type AgentObservationRecord,
} from '../../db/sqlite'
import { withMiniMaxErrorBoundary } from '../../services/api-errors'
import { buildAgentEvent } from '../../services/agent-events'
import { markKeyActivity } from '../../services/key-activity'
import { normalizeMediaPrompt } from '../../services/media'
import { createMiniMaxClient } from '../../services/minimax'

const videoBodySchema = z.object({
  prompt: z.string().trim().min(1).max(1000),
})

export function recordMediaObservation(input: {
  agentId: string
  taskId: string
  mediaType: 'image' | 'music' | 'video'
  summary: string
  now: string
  observations: { addObservation: (record: AgentObservationRecord) => void }
  events: { addEvent: (record: AgentEventRecord) => void }
}) {
  const observationId = `observation_${nanoid()}`

  input.observations.addObservation({
    id: observationId,
    agentId: input.agentId,
    sourceType: 'media',
    sourceId: input.taskId,
    summary: input.summary,
    payloadJson: JSON.stringify({ taskId: input.taskId, mediaType: input.mediaType }),
    createdAt: input.now,
  })
  input.events.addEvent(buildAgentEvent({
    id: `event_${nanoid()}`,
    agentId: input.agentId,
    type: 'observation.created',
    title: '观察记录',
    summary: '媒体任务已记录。',
    targetType: 'observation',
    targetId: observationId,
    payload: { taskId: input.taskId, mediaType: input.mediaType },
    createdAt: input.now,
  }))
}

export default defineEventHandler(async (event) => {
  const keyId = event.context.keyId
  const body = videoBodySchema.safeParse(await readBody(event))

  if (!keyId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (!body.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid video prompt' })
  }

  const config = useRuntimeConfig(event)
  const repo = createMediaTaskRepository(config.sqlitePath)
  const client = createMiniMaxClient({
    apiKey: config.minimaxApiKey,
    groupId: config.minimaxGroupId,
  })
  const now = new Date().toISOString()
  const id = nanoid()
  const prompt = normalizeMediaPrompt(body.data.prompt)

  repo.addMediaTask({
    id,
    keyId,
    type: 'video',
    providerTaskId: null,
    status: 'pending',
    prompt,
    resultUrl: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  })

  try {
    const result = await withMiniMaxErrorBoundary(() => client.createVideoTask(prompt), 'Video task failed')

    if (!result.providerTaskId) {
      throw new Error('MiniMax did not return a video task id')
    }

    repo.updateMediaTask(id, {
      providerTaskId: result.providerTaskId,
      status: 'processing',
      updatedAt: new Date().toISOString(),
    })
    markKeyActivity(config.sqlitePath, keyId, 'media')
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
        summary: '视频生成任务已创建。',
        now,
        observations: createAgentObservationRepository(config.sqlitePath),
        events: createAgentEventRepository(config.sqlitePath),
      })
    }
    catch {
      // Observation capture is secondary.
    }

    return { taskId: id }
  }
  catch (error) {
    repo.updateMediaTask(id, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown video task error',
      updatedAt: new Date().toISOString(),
    })

    throw createError({ statusCode: 502, statusMessage: 'Video task failed' })
  }
})
