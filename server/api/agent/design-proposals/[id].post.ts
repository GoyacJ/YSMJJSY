import { createError, defineEventHandler, getRouterParam } from 'h3'
import {
  createAgentEvolutionRepository,
  createKeyDesignRepository,
  createKeyProfileRepository,
} from '../../../db/sqlite'
import { createDefaultDesignSchema, parseDesignSchema } from '../../../services/design-schema'
import { createMiniMaxClient } from '../../../services/minimax'
import { withMiniMaxErrorBoundary } from '../../../services/api-errors'
import { requireAgentKey } from '../core.get'

export function parseDesignProposalInstruction(payloadJson: string) {
  let payload: unknown

  try {
    payload = JSON.parse(payloadJson)
  }
  catch {
    throw new Error('Invalid design proposal payload')
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid design proposal payload')
  }

  const instruction = (payload as { instruction?: unknown }).instruction

  if (typeof instruction !== 'string' || !instruction.trim()) {
    throw new Error('Invalid design proposal instruction')
  }

  return instruction.trim()
}

export default defineEventHandler(async (event) => {
  const keyId = requireAgentKey(event)
  const proposalId = getRouterParam(event, 'id')

  if (!proposalId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing proposal id' })
  }

  const config = useRuntimeConfig(event)
  const proposal = createAgentEvolutionRepository(config.sqlitePath)
    .listProposalsByKey(keyId)
    .find(item => item.id === proposalId)

  if (!proposal || proposal.type !== 'page_design') {
    throw createError({ statusCode: 404, statusMessage: 'Design proposal not found' })
  }

  let instruction: string

  try {
    instruction = parseDesignProposalInstruction(proposal.payloadJson)
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid design proposal payload' })
  }

  const designs = createKeyDesignRepository(config.sqlitePath)
  const latest = designs.getLatestDesign(keyId)
  const currentSchema = latest
    ? parseDesignSchema(JSON.parse(latest.schemaJson))
    : createDefaultDesignSchema()
  const profile = createKeyProfileRepository(config.sqlitePath).getKeyProfile(keyId)
  const client = createMiniMaxClient({
    apiKey: config.minimaxApiKey,
    groupId: config.minimaxGroupId,
  })
  const generated = await withMiniMaxErrorBoundary(
    () => client.generateDesignPatch({
      currentSchema,
      instruction,
      assistantName: profile?.assistantName || '星信',
      mbti: profile?.mbti || 'INTJ',
    }),
    'Design generation failed',
  )

  return {
    schema: parseDesignSchema(generated),
  }
})
