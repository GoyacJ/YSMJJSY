import { describe, expect, it } from 'vitest'
import { createMiniMaxClient, MiniMaxError } from './minimax'

describe('minimax client', () => {
  it('adds bearer auth to requests', async () => {
    const calls: HeadersInit[] = []
    const client = createMiniMaxClient({
      apiKey: 'key',
      groupId: 'group',
      fetcher: async (_url, init) => {
        calls.push(init?.headers ?? {})
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
    })

    await client.request('/test', { method: 'POST', body: {} })

    expect(JSON.stringify(calls[0])).toContain('Bearer key')
  })

  it('wraps upstream failures', async () => {
    const client = createMiniMaxClient({
      apiKey: 'key',
      groupId: 'group',
      fetcher: async () => new Response('bad', { status: 500 }),
    })

    await expect(client.request('/test', { method: 'POST', body: {} })).rejects.toBeInstanceOf(MiniMaxError)
  })
})
