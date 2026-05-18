import { nanoid } from 'nanoid'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import {
  createAgentEventRepository,
  createAgentInstanceRepository,
  createAgentObservationRepository,
} from '../db/sqlite'
import { withMiniMaxErrorBoundary } from '../services/api-errors'
import { markKeyActivity } from '../services/key-activity'
import { getDefaultMusicPrompt } from '../services/media'
import { createMiniMaxClient } from '../services/minimax'
import { recordMediaObservation } from './video/tasks.post'
import { createAgentToolRegistry } from '../services/agent-runtime'
import { registerStarAgentTools } from '../services/star-agent-tools'
import { generateMediaWithTool } from './image.post'

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
  const registry = createAgentToolRegistry()
  const prompt = body.data.prompt || getDefaultMusicPrompt()

  registerStarAgentTools(registry, {
    media: {
      generateMusic: value => client.generateMusic(value),
    },
  })

  const result = await withMiniMaxErrorBoundary(
    () => generateMediaWithTool({
      toolName: 'star.generateMusic',
      prompt,
      registry,
    }),
    'Music generation failed',
  )

  if (keyId) {
    markKeyActivity(config.sqlitePath, keyId, 'media')
    try {
      const now = new Date().toISOString()
      const agent = createAgentInstanceRepository(config.sqlitePath).getOrCreateAgentForOwner({
        ownerType: 'key',
        ownerId: keyId,
        domain: 'star',
        now,
      })

      recordMediaObservation({
        agentId: agent.id,
        taskId: `music_${nanoid()}`,
        mediaType: 'music',
        summary: '音乐生成已完成。',
        now,
        observations: createAgentObservationRepository(config.sqlitePath),
        events: createAgentEventRepository(config.sqlitePath),
      })
    }
    catch {
      // Observation capture is secondary.
    }
  }

  return result
})
