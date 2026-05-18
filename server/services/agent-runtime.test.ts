import { describe, expect, it, vi } from 'vitest'
import { createAgentProviderRegistry, createAgentToolRegistry, createMiniMaxAgentModelProvider } from './agent-runtime'

describe('agent runtime seams', () => {
  it('registers, lists, resolves, and executes agent tools by name', async () => {
    const registry = createAgentToolRegistry()
    const execute = vi.fn(async input => ({ ok: true, output: input }))

    registry.register({
      name: 'star.previewDesign',
      description: 'Preview a page design.',
      riskLevel: 'high',
      approvalRequired: true,
      execute,
    })

    expect(registry.list()).toEqual([
      {
        name: 'star.previewDesign',
        description: 'Preview a page design.',
        riskLevel: 'high',
        approvalRequired: true,
      },
    ])
    expect(registry.get('star.previewDesign')?.name).toBe('star.previewDesign')
    await expect(registry.execute('star.previewDesign', { instruction: 'more stars' })).resolves.toEqual({
      ok: true,
      output: { instruction: 'more stars' },
    })
    expect(execute).toHaveBeenCalledWith({ instruction: 'more stars' })
  })

  it('throws when executing an unknown agent tool', async () => {
    const registry = createAgentToolRegistry()

    await expect(registry.execute('missing.tool', {})).rejects.toThrow('Agent tool not found: missing.tool')
  })

  it('wraps MiniMax clients behind an agent model provider', async () => {
    const client = {
      chat: vi.fn(async () => ({ reply: 'reply' })),
      reflectAgent: vi.fn(async () => '{"summary":"ok"}'),
      generateDesignPatch: vi.fn(async () => ({ version: 1 })),
    }
    const provider = createMiniMaxAgentModelProvider(client)
    const messages = [{ role: 'user' as const, content: 'hello' }]
    const designInput = {
      currentSchema: {
        version: 1 as const,
        theme: 'star-letter' as const,
        palette: 'midnight' as const,
        title: '星信',
        subtitle: '测试',
        sections: [],
      },
      instruction: 'x',
      assistantName: '星AI',
      mbti: 'INTJ',
    }

    await expect(provider.chat(messages)).resolves.toEqual({ reply: 'reply' })
    await expect(provider.reflect(messages)).resolves.toBe('{"summary":"ok"}')
    await expect(provider.generateDesignPatch(designInput)).resolves.toEqual({ version: 1 })
    expect(client.chat).toHaveBeenCalledWith(messages)
    expect(client.reflectAgent).toHaveBeenCalledWith(messages)
    expect(client.generateDesignPatch).toHaveBeenCalledWith(designInput)
  })

  it('uses provider-neutral agent messages', async () => {
    const provider = createMiniMaxAgentModelProvider({
      chat: vi.fn(async () => ({ reply: 'ok' })),
      reflectAgent: vi.fn(async () => '{"summary":"ok"}'),
      generateDesignPatch: vi.fn(async input => input.currentSchema),
    } as any)

    await provider.reflect([{ role: 'user', content: 'hello' }])
    expect(typeof provider.reflect).toBe('function')
  })

  it('registers and resolves model providers by name', () => {
    const registry = createAgentProviderRegistry()
    const provider = {
      name: 'fake',
      chat: vi.fn(),
      reflect: vi.fn(),
      generateDesignPatch: vi.fn(),
    }

    registry.register(provider)

    expect(registry.get('fake')).toBe(provider)
    expect(registry.getDefault()).toBe(provider)
  })
})
