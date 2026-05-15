import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { getDefaultMusicPrompt } from '../services/media'
import { createMiniMaxClient } from '../services/minimax'

const musicBodySchema = z.object({
  prompt: z.string().trim().max(800).optional(),
})

export default defineEventHandler(async (event) => {
  const body = musicBodySchema.safeParse(await readBody(event))
  const config = useRuntimeConfig(event)
  const client = createMiniMaxClient({
    apiKey: config.minimaxApiKey,
    groupId: config.minimaxGroupId,
  })

  return client.generateMusic(body.success && body.data.prompt ? body.data.prompt : getDefaultMusicPrompt())
})
