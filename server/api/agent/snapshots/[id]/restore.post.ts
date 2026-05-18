import { createError, defineEventHandler, getRouterParam } from 'h3'
import {
  createAgentSnapshotRepository,
  createAgentStateRepository,
  createKeyDesignRepository,
  type AgentStateRecord,
  type AgentStateSnapshotRecord,
  type KeyDesignRecord,
} from '../../../../db/sqlite'
import { parseDesignSchema } from '../../../../services/design-schema'
import { requireAgentKey } from '../../core.get'

type RestoreAgentSnapshotActionInput = {
  keyId: string
  snapshotId: string
  snapshots: {
    getSnapshotByKey: (keyId: string, id: string) => AgentStateSnapshotRecord | undefined
  }
  states: {
    updateAgentState: (keyId: string, updates: Partial<Omit<AgentStateRecord, 'keyId'>> & { updatedAt: string }) => void
  }
  designs?: {
    getLatestDesign: (keyId: string) => Pick<KeyDesignRecord, 'version'> | undefined
    addKeyDesign: (record: { keyId: string, version: number, schemaJson: string, prompt: string, createdAt: string }) => void
  }
  now: string
}

function parseSnapshotAgentState(profileJson: string) {
  try {
    const parsed = JSON.parse(profileJson)
    const agentState = parsed?.agentState

    if (!agentState || typeof agentState !== 'object' || Array.isArray(agentState)) {
      return null
    }

    return {
      tone: typeof agentState.tone === 'string' ? agentState.tone : undefined,
      relationshipRole: typeof agentState.relationshipRole === 'string' ? agentState.relationshipRole : undefined,
      learningMode: agentState.learningMode === 'manual' || agentState.learningMode === 'assisted' || agentState.learningMode === 'auto'
        ? agentState.learningMode
        : undefined,
      contentStrategy: agentState.contentStrategy && typeof agentState.contentStrategy === 'object' && !Array.isArray(agentState.contentStrategy)
        ? agentState.contentStrategy
        : {},
    }
  }
  catch {
    return null
  }
}

function parseSnapshotPageDesign(profileJson: string) {
  try {
    const parsed = JSON.parse(profileJson)
    const acceptedProposal = parsed?.acceptedProposal

    if (acceptedProposal?.type !== 'page_design') {
      return null
    }

    const schema = parseDesignSchema(acceptedProposal.payload?.schema)

    return {
      schema,
    }
  }
  catch {
    return null
  }
}

export function restoreAgentSnapshotAction(input: RestoreAgentSnapshotActionInput) {
  const snapshot = input.snapshots.getSnapshotByKey(input.keyId, input.snapshotId)

  if (!snapshot) {
    return {
      restored: false,
    }
  }

  const pageDesign = parseSnapshotPageDesign(snapshot.profileJson)

  if (pageDesign) {
    if (!input.designs) {
      return {
        restored: false,
      }
    }

    const latest = input.designs.getLatestDesign(input.keyId)
    const version = latest ? latest.version + 1 : 1

    input.designs.addKeyDesign({
      keyId: input.keyId,
      version,
      schemaJson: JSON.stringify(pageDesign.schema),
      prompt: `restore snapshot ${snapshot.id}`,
      createdAt: input.now,
    })

    return {
      restored: true,
      snapshotId: snapshot.id,
      restoredType: 'page_design',
      version,
    }
  }

  const agentState = parseSnapshotAgentState(snapshot.profileJson)

  if (!agentState?.tone || !agentState.relationshipRole || !agentState.learningMode) {
    return {
      restored: false,
    }
  }

  input.states.updateAgentState(input.keyId, {
    tone: agentState.tone,
    relationshipRole: agentState.relationshipRole,
    learningMode: agentState.learningMode,
    contentStrategy: agentState.contentStrategy,
    updatedAt: input.now,
  })

  return {
    restored: true,
    snapshotId: snapshot.id,
  }
}

export default defineEventHandler((event) => {
  const keyId = requireAgentKey(event)
  const snapshotId = getRouterParam(event, 'id')

  if (!snapshotId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing snapshot id',
    })
  }

  const config = useRuntimeConfig(event)
  const result = restoreAgentSnapshotAction({
    keyId,
    snapshotId,
    snapshots: createAgentSnapshotRepository(config.sqlitePath),
    states: createAgentStateRepository(config.sqlitePath),
    designs: createKeyDesignRepository(config.sqlitePath),
    now: new Date().toISOString(),
  })

  if (!result.restored) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Snapshot not restorable',
    })
  }

  return result
})
