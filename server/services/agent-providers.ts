import { createMiniMaxClient } from './minimax'
import { createAgentProviderRegistry, createMiniMaxAgentModelProvider } from './agent-runtime'

export function createDefaultAgentModelProvider(config: {
  minimaxApiKey: string
  minimaxGroupId?: string
}) {
  return {
    name: 'minimax',
    ...createMiniMaxAgentModelProvider(createMiniMaxClient({
      apiKey: config.minimaxApiKey,
      groupId: config.minimaxGroupId,
    })),
  }
}

export function createDefaultAgentProviderRegistry(config: {
  minimaxApiKey: string
  minimaxGroupId?: string
}) {
  const registry = createAgentProviderRegistry()

  registry.register(createDefaultAgentModelProvider(config))

  return registry
}
