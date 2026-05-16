import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { withMiniMaxErrorBoundary } from '../services/api-errors'
import { markKeyActivity } from '../services/key-activity'
import { normalizeMediaPrompt } from '../services/media'
import { createMiniMaxClient } from '../services/minimax'

const imageBodySchema = z.object({
  prompt: z.string().trim().min(1).max(800),
})

export default defineEventHandler(async (event) => {
  const keyId = event.context.keyId
  const body = imageBodySchema.safeParse(await readBody(event))

  if (!body.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid image prompt' })
  }

  const config = useRuntimeConfig(event)
  const client = createMiniMaxClient({
    apiKey: config.minimaxApiKey,
    groupId: config.minimaxGroupId,
  })

  const result = await withMiniMaxErrorBoundary(() => client.generateImage(normalizeMediaPrompt(body.data.prompt)), 'Image generation failed')

  if (keyId) {
    markKeyActivity(config.sqlitePath, keyId, 'media')
  }

  return result
})
