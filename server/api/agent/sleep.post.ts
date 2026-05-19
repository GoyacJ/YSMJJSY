import { createError, defineEventHandler } from 'h3'
import {
  createAgentEventRepository,
  createAgentEvolutionRepository,
  createAgentInstanceRepository,
  createAgentReflectionRepository,
  createAgentSleepRepository,
  createAgentStateRepository,
  createAgentTaskRepository,
  createConversationRepository,
  createKeyProfileRepository,
  createMemoryRepository,
} from '../../db/sqlite'
import { createDefaultAgentProviderRegistry } from '../../services/agent-providers'
import { runManualAgentSleep, type ManualAgentSleepInput } from '../../services/agent-sleep'
import { requireAgentKey } from './core.get'

export { runManualAgentSleep }
export type { ManualAgentSleepInput }

export default defineEventHandler(async (event) => {
  const keyId = requireAgentKey(event)
  const config = useRuntimeConfig(event)
  const profile = createKeyProfileRepository(config.sqlitePath).getKeyProfile(keyId)

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Profile not found',
    })
  }

  const providerRegistry = createDefaultAgentProviderRegistry({
    minimaxApiKey: config.minimaxApiKey,
    minimaxGroupId: config.minimaxGroupId,
  })
  const client = providerRegistry.getDefault()
  const states = createAgentStateRepository(config.sqlitePath)
  const now = new Date().toISOString()
  const agent = createAgentInstanceRepository(config.sqlitePath).getOrCreateAgentForOwner({
    ownerType: 'key',
    ownerId: keyId,
    domain: 'star',
    now,
  })

  return runManualAgentSleep({
    keyId,
    now,
    agent,
    client,
    profile,
    agentState: states.getOrCreateAgentState(keyId, now),
    memories: createMemoryRepository(config.sqlitePath),
    conversations: createConversationRepository(config.sqlitePath),
    reflections: createAgentReflectionRepository(config.sqlitePath),
    proposals: createAgentEvolutionRepository(config.sqlitePath),
    sleeps: createAgentSleepRepository(config.sqlitePath),
    states,
    tasks: createAgentTaskRepository(config.sqlitePath),
    events: createAgentEventRepository(config.sqlitePath),
  })
})
