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

  it('removes thinking tags from chat replies', async () => {
    const client = createMiniMaxClient({
      apiKey: 'key',
      fetcher: async () => new Response(JSON.stringify({
        choices: [{
          message: {
            content: '<think>hidden reasoning</think>星信已连接。',
          },
        }],
      }), { status: 200 }),
    })

    await expect(client.chat([])).resolves.toEqual({
      reply: '星信已连接。',
    })
  })

  it('normalizes hex audio responses to base64', async () => {
    const client = createMiniMaxClient({
      apiKey: 'key',
      fetcher: async () => new Response(JSON.stringify({
        data: {
          audio: '494433',
        },
      }), { status: 200 }),
    })

    await expect(client.textToSpeech('测试')).resolves.toEqual({
      base64: 'SUQz',
    })
  })

  it('treats non-zero provider status codes as upstream failures', async () => {
    const client = createMiniMaxClient({
      apiKey: 'key',
      fetcher: async () => new Response(JSON.stringify({
        base_resp: {
          status_code: 1004,
          status_msg: 'invalid model',
        },
      }), { status: 200 }),
    })

    await expect(client.textToSpeech('测试')).rejects.toBeInstanceOf(MiniMaxError)
  })

  it('uses the current MiniMax video model', async () => {
    let requestBody: any
    const client = createMiniMaxClient({
      apiKey: 'key',
      fetcher: async (_url, init) => {
        requestBody = JSON.parse(String(init?.body))
        return new Response(JSON.stringify({ task_id: 'task-1' }), { status: 200 })
      },
    })

    await client.createVideoTask('星空')

    expect(requestBody.model).toBe('MiniMax-Hailuo-2.3')
  })
})
