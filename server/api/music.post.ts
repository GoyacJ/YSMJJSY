import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { withMiniMaxErrorBoundary } from '../services/api-errors'
import { markKeyActivity } from '../services/key-activity'
import { getDefaultMusicPrompt } from '../services/media'
import { createMiniMaxClient } from '../services/minimax'

const musicBodySchema = z.object({
  prompt: z.string().trim().max(800).optional(),
})

export default defineEventHandler(async (event) => {
  const keyId = event.context.keyId
  const body = musicBodySchema.safeParse(await readBody(event))

  if (!body.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid music prompt' })
  }

  const config = useRuntimeConfig(event)
  const client = createMiniMaxClient({
    apiKey: config.minimaxApiKey,
    groupId: config.minimaxGroupId,
  })

  const result = await withMiniMaxErrorBoundary(() => client.generateMusic(body.data.prompt || getDefaultMusicPrompt()), 'Music generation failed')

  if (keyId) {
    markKeyActivity(config.sqlitePath, keyId, 'media')
  }

  return result
})
