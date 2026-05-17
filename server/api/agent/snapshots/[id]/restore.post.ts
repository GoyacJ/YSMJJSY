import { createError, defineEventHandler, getRouterParam } from 'h3'
import {
  createAgentSnapshotRepository,
  createAgentStateRepository,
  type AgentStateRecord,
  type AgentStateSnapshotRecord,
} from '../../../../db/sqlite'
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

export function restoreAgentSnapshotAction(input: RestoreAgentSnapshotActionInput) {
  const snapshot = input.snapshots.getSnapshotByKey(input.keyId, input.snapshotId)

  if (!snapshot) {
    return {
      restored: false,
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
