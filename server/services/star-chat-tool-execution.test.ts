import { describe, expect, it, vi } from 'vitest'
import { createAgentToolRegistry } from './agent-runtime'
import type { StarChatTurnPlan } from './star-chat-planner'
import { normalizeStarChatToolCalls } from './star-chat-tool-execution'

function createRegistry() {
  const registry = createAgentToolRegistry()

  registry.register({
    name: 'star.generateImage',
    description: 'Generate image.',
    riskLevel: 'medium',
    approvalRequired: false,
    execute: vi.fn(),
  })
  registry.register({
    name: 'star.speakReply',
    description: 'Speak reply.',
    riskLevel: 'low',
    approvalRequired: false,
    execute: vi.fn(),
  })

  return registry
}

describe('star chat tool execution', () => {
  it('rejects unknown tools', () => {
    const calls = normalizeStarChatToolCalls({
      plan: {
        reply: '',
        toolSearches: [],
        toolCalls: [{ toolName: 'missing.tool', input: {}, mode: 'execute', evidence: '', reason: '' }],
      },
      registry: createRegistry(),
      reply: '',
    })

    expect(calls).toEqual([
      expect.objectContaining({
        toolName: 'missing.tool',
        status: 'rejected',
        error: 'Unknown tool',
      }),
    ])
  })

  it('rejects media calls without a prompt', () => {
    const calls = normalizeStarChatToolCalls({
      plan: {
        reply: '',
        toolSearches: [],
        toolCalls: [{ toolName: 'star.generateImage', input: {}, mode: 'execute', evidence: '', reason: '' }],
      },
      registry: createRegistry(),
      reply: '',
    })

    expect(calls[0]).toMatchObject({
      toolName: 'star.generateImage',
      status: 'rejected',
      error: 'Missing prompt',
    })
  })

  it('replaces speak reply placeholder with final reply text', () => {
    const calls = normalizeStarChatToolCalls({
      plan: {
        reply: '你好',
        toolSearches: [],
        toolCalls: [{ toolName: 'star.speakReply', input: { text: '$reply' }, mode: 'execute', evidence: '', reason: '' }],
      },
      registry: createRegistry(),
      reply: '最终回复',
    })

    expect(calls[0]).toMatchObject({
      toolName: 'star.speakReply',
      status: 'ready',
      input: { text: '最终回复' },
    })
  })

  it('caps tool calls at four', () => {
    const plan: StarChatTurnPlan = {
      reply: '',
      toolSearches: [],
      toolCalls: Array.from({ length: 6 }, (_, index) => ({
        toolName: 'star.speakReply',
        input: { text: String(index) },
        mode: 'execute',
        evidence: '',
        reason: '',
      })),
    }

    expect(normalizeStarChatToolCalls({
      plan,
      registry: createRegistry(),
      reply: '',
    })).toHaveLength(4)
  })
})
