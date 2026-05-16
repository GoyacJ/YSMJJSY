import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { withMiniMaxErrorBoundary } from '../services/api-errors'
import { markKeyActivity } from '../services/key-activity'
import { createMiniMaxClient } from '../services/minimax'

const ttsBodySchema = z.object({
  text: z.string().trim().min(1).max(500),
})

export default defineEventHandler(async (event) => {
  const keyId = event.context.keyId
  const body = ttsBodySchema.safeParse(await readBody(event))

  if (!body.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid TTS text' })
  }

  const config = useRuntimeConfig(event)
  const client = createMiniMaxClient({
    apiKey: config.minimaxApiKey,
    groupId: config.minimaxGroupId,
  })

  const result = await withMiniMaxErrorBoundary(() => client.textToSpeech(body.data.text), 'TTS generation failed')

  if (keyId) {
    markKeyActivity(config.sqlitePath, keyId, 'media')
  }

  return result
})
