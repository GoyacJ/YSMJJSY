import { describe, expect, it } from 'vitest'
import { createDefaultAgentModelProvider, createDefaultAgentProviderRegistry } from './agent-providers'

describe('agent providers', () => {
  it('creates the default named MiniMax provider', () => {
    const provider = createDefaultAgentModelProvider({
      minimaxApiKey: 'key',
      minimaxGroupId: 'group',
    })

    expect(provider.name).toBe('minimax')
    expect(typeof provider.chat).toBe('function')
    expect(typeof provider.reflect).toBe('function')
    expect(typeof provider.generateDesignPatch).toBe('function')
  })

  it('registers the default provider behind the provider registry', () => {
    const registry = createDefaultAgentProviderRegistry({
      minimaxApiKey: 'key',
      minimaxGroupId: 'group',
    })

    expect(registry.getDefault().name).toBe('minimax')
    expect(registry.get('minimax')).toBe(registry.getDefault())
  })
})
