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
import { normalizeMediaPrompt } from '../services/media'
import { createMiniMaxClient } from '../services/minimax'
import { recordMediaObservation } from './video/tasks.post'
import { createAgentToolRegistry, type AgentToolRegistry } from '../services/agent-runtime'
import { registerStarAgentTools } from '../services/star-agent-tools'

const imageBodySchema = z.object({
  prompt: z.string().trim().min(1).max(800),
})

export async function generateMediaWithTool(input: {
  toolName: 'star.generateImage' | 'star.generateMusic' | 'star.generateVideo'
  prompt: string
  registry: Pick<AgentToolRegistry, 'execute'>
}) {
  const result = await input.registry.execute(input.toolName, { prompt: input.prompt })

  if (!result.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: result.error ?? 'Media generation failed',
    })
  }

  return result.output
}

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
  const registry = createAgentToolRegistry()

  registerStarAgentTools(registry, {
    media: {
      generateImage: prompt => client.generateImage(normalizeMediaPrompt(prompt)),
    },
  })

  const result = await withMiniMaxErrorBoundary(
    () => generateMediaWithTool({
      toolName: 'star.generateImage',
      prompt: body.data.prompt,
      registry,
    }),
    'Image generation failed',
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
        taskId: `image_${nanoid()}`,
        mediaType: 'image',
        summary: '图片生成已完成。',
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
