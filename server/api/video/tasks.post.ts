import { nanoid } from 'nanoid'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { createMediaTaskRepository } from '../../db/sqlite'
import { withMiniMaxErrorBoundary } from '../../services/api-errors'
import { normalizeMediaPrompt } from '../../services/media'
import { createMiniMaxClient } from '../../services/minimax'

const videoBodySchema = z.object({
  prompt: z.string().trim().min(1).max(1000),
})

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
