import { nanoid } from 'nanoid'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import {
  createAgentEventRepository,
  createAgentEvolutionRepository,
  createAgentInstanceRepository,
  createAgentObservationRepository,
  createAgentSnapshotRepository,
  createAgentWorkRepository,
  createKeyDesignRepository,
  createKeyProfileRepository,
  type AgentStateSnapshotRecord,
} from '../../db/sqlite'
import type { StarPageDesignSchema } from '../../../types/design-schema'
import { parseDesignSchema } from '../../services/design-schema'
import { markKeyActivity } from '../../services/key-activity'
import {
  buildWorkFromCommittedDesign,
  commitKeyDesign,
  getNextDesignVersion,
  recordDesignObservation,
} from '../../services/design-commit'

export {
  buildWorkFromCommittedDesign,
  getNextDesignVersion,
  recordDesignObservation,
}

const commitBodySchema = z.object({
  schema: z.unknown(),
  prompt: z.string().trim().max(800).default(''),
  proposalId: z.string().trim().min(1).optional(),
})

export function buildDesignCommitResponse(version: number) {
  return { ok: true, version }
}

export function buildDesignProposalSnapshot(input: {
  id: string
  keyId: string
  proposalId: string
  profile: {
    assistantName: string
    mbti: string
  }
  schema: StarPageDesignSchema
  version: number
  now: string
}): AgentStateSnapshotRecord {
  return {
    id: input.id,
    keyId: input.keyId,
    proposalId: input.proposalId,
    profileJson: JSON.stringify({
      assistantName: input.profile.assistantName,
      mbti: input.profile.mbti,
      acceptedProposal: {
        type: 'page_design',
        payload: {
          version: input.version,
          schema: input.schema,
        },
      },
    }),
    createdAt: input.now,
  }
}

export default defineEventHandler(async (event) => {
  const keyId = event.context.keyId

  if (!keyId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = commitBodySchema.safeParse(await readBody(event))

  if (!body.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid design schema' })
  }

  let schema

  try {
    schema = parseDesignSchema(body.data.schema)
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid design schema' })
  }

  const config = useRuntimeConfig(event)
  let proposalProfile: { assistantName: string, mbti: string } | null = null

  if (body.data.proposalId) {
    const proposal = createAgentEvolutionRepository(config.sqlitePath)
      .listProposalsByKey(keyId)
      .find(item => item.id === body.data.proposalId)

    if (!proposal || proposal.type !== 'page_design') {
      throw createError({ statusCode: 404, statusMessage: 'Design proposal not found' })
    }

    const profile = createKeyProfileRepository(config.sqlitePath).getKeyProfile(keyId)

    if (!profile) {
      throw createError({ statusCode: 404, statusMessage: 'Profile not found' })
    }

    proposalProfile = {
      assistantName: profile.assistantName,
      mbti: profile.mbti,
    }
  }

  const now = new Date().toISOString()
  let observation: Parameters<typeof commitKeyDesign>[0]['observation']

  try {
    const agent = createAgentInstanceRepository(config.sqlitePath).getOrCreateAgentForOwner({
      ownerType: 'key',
      ownerId: keyId,
      domain: 'star',
      now,
    })

    observation = {
      agentId: agent.id,
      observations: createAgentObservationRepository(config.sqlitePath),
      events: createAgentEventRepository(config.sqlitePath),
    }
  }
  catch {
    observation = undefined
  }

  const result = commitKeyDesign({
    keyId,
    schema,
    prompt: body.data.prompt,
    now,
    designs: createKeyDesignRepository(config.sqlitePath),
    works: createAgentWorkRepository(config.sqlitePath),
    markActivity: (id, kind) => markKeyActivity(config.sqlitePath, id, kind),
    observation,
  })
  const version = result.version

  if (body.data.proposalId && proposalProfile) {
    createAgentEvolutionRepository(config.sqlitePath).updateProposal(body.data.proposalId, {
      status: 'applied',
      updatedAt: now,
    })
    createAgentSnapshotRepository(config.sqlitePath).addSnapshot(buildDesignProposalSnapshot({
      id: nanoid(),
      keyId,
      proposalId: body.data.proposalId,
      profile: proposalProfile,
      schema,
      version,
      now,
    }))
  }

  return buildDesignCommitResponse(version)
})
