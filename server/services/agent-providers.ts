import { createMiniMaxClient } from './minimax'
import { createMiniMaxAgentModelProvider } from './agent-runtime'

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
