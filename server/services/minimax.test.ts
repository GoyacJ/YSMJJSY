import { describe, expect, it } from 'vitest'
import { createMiniMaxClient, MiniMaxError, normalizeTokenPlanRemains } from './minimax'

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

  it('streams chat deltas from MiniMax SSE responses', async () => {
    let requestBody: any
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"你"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"好"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    const client = createMiniMaxClient({
      apiKey: 'key',
      fetcher: async (_url, init) => {
        requestBody = JSON.parse(String(init?.body))
        return new Response(stream, { status: 200 })
      },
    })

    const chunks: string[] = []

    for await (const chunk of client.chatStream([])) {
      chunks.push(chunk)
    }

    expect(requestBody.stream).toBe(true)
    expect(chunks).toEqual(['你', '好'])
  })

  it('filters thinking tags while streaming chat deltas', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"<think>隐藏"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"</think>正文"}}]}\n\n'))
        controller.close()
      },
    })
    const client = createMiniMaxClient({
      apiKey: 'key',
      fetcher: async () => new Response(stream, { status: 200 }),
    })

    const chunks: string[] = []

    for await (const chunk of client.chatStream([])) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(['正文'])
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

  it('uses the Token Plan speech HD model for TTS', async () => {
    let requestBody: any
    const client = createMiniMaxClient({
      apiKey: 'key',
      fetcher: async (_url, init) => {
        requestBody = JSON.parse(String(init?.body))
        return new Response(JSON.stringify({
          data: {
            audio: '494433',
          },
        }), { status: 200 })
      },
    })

    await client.textToSpeech('测试')

    expect(requestBody.model).toBe('speech-2.8-hd')
  })

  it('streams speech hex chunks with stream enabled', async () => {
    let requestBody: any
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"data":{"audio":"4944"}}\n\n'))
        controller.enqueue(encoder.encode('data: {"data":{"audio":"33"}}\n\n'))
        controller.close()
      },
    })
    const client = createMiniMaxClient({
      apiKey: 'key',
      fetcher: async (_url, init) => {
        requestBody = JSON.parse(String(init?.body))
        return new Response(stream, { status: 200 })
      },
    })

    const chunks: string[] = []

    for await (const chunk of client.textToSpeechStream('测试')) {
      chunks.push(chunk)
    }

    expect(requestBody.stream).toBe(true)
    expect(requestBody.output_format).toBe('hex')
    expect(chunks).toEqual(['4944', '33'])
  })

  it('streams music hex chunks with stream enabled', async () => {
    let requestBody: any
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"data":{"audio":"4944"}}\n'))
        controller.enqueue(encoder.encode('{"data":{"audio":"33"}}\n'))
        controller.close()
      },
    })
    const client = createMiniMaxClient({
      apiKey: 'key',
      fetcher: async (_url, init) => {
        requestBody = JSON.parse(String(init?.body))
        return new Response(stream, { status: 200 })
      },
    })

    const chunks: string[] = []

    for await (const chunk of client.generateMusicStream('星空')) {
      chunks.push(chunk)
    }

    expect(requestBody.stream).toBe(true)
    expect(requestBody.output_format).toBe('hex')
    expect(chunks).toEqual(['4944', '33'])
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

  it('calls MiniMax image understanding for image descriptions', async () => {
    let requestUrl = ''
    let requestBody: any
    const client = createMiniMaxClient({
      apiKey: 'key',
      fetcher: async (url, init) => {
        requestUrl = String(url)
        requestBody = JSON.parse(String(init?.body))
        return new Response(JSON.stringify({ content: '图片里是一片星空。' }), { status: 200 })
      },
    })

    await expect(client.describeImage('data:image/png;base64,abc', '描述图片')).resolves.toBe('图片里是一片星空。')
    expect(requestUrl).toContain('/v1/coding_plan/vlm')
    expect(requestBody).toEqual({
      prompt: '描述图片',
      image_url: 'data:image/png;base64,abc',
    })
  })

  it('normalizes alternate image understanding response shapes', async () => {
    const client = createMiniMaxClient({
      apiKey: 'key',
      fetcher: async () => new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: '图片里有花。',
            },
          },
        ],
      }), { status: 200 }),
    })

    await expect(client.describeImage('data:image/png;base64,abc', '描述图片')).resolves.toBe('图片里有花。')
  })

  it('normalizes Token Plan remains into feature quotas', () => {
    const result = normalizeTokenPlanRemains({
      model_remains: [
        {
          model_name: 'MiniMax-M*',
          current_interval_total_count: 1500,
          current_interval_usage_count: 5,
          end_time: 1778878800000,
        },
        {
          model_name: 'speech-hd',
          current_interval_total_count: 4000,
          current_interval_usage_count: 12,
          end_time: 1778947200000,
        },
        {
          model_name: 'image-01',
          current_interval_total_count: 50,
          current_interval_usage_count: 2,
          end_time: 1778947200000,
        },
        {
          model_name: 'music-2.6',
          current_interval_total_count: 100,
          current_interval_usage_count: 3,
          end_time: 1778947200000,
        },
        {
          model_name: 'MiniMax-Hailuo-2.3-6s-768p',
          current_interval_total_count: 0,
          current_interval_usage_count: 0,
          end_time: 1778947200000,
        },
      ],
    })

    expect(result).toEqual([
      expect.objectContaining({ key: 'chat', label: '星信', used: 5, total: 1500, remaining: 1495, available: true }),
      expect.objectContaining({ key: 'audio', label: '听一听', used: 12, total: 4000, remaining: 3988, available: true }),
      expect.objectContaining({ key: 'image', label: '画一张', used: 2, total: 50, remaining: 48, available: true }),
      expect.objectContaining({ key: 'music', label: '写一首', used: 3, total: 100, remaining: 97, available: true }),
      expect.objectContaining({ key: 'video', label: '做一段', used: 0, total: 0, remaining: 0, available: false }),
    ])
  })

  it('generates JSON-only design patches', async () => {
    let requestBody: any
    const client = createMiniMaxClient({
      apiKey: 'key',
      fetcher: async (_url, init) => {
        requestBody = JSON.parse(String(init?.body))
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: '{"version":1,"theme":"star-letter","palette":"rose-gold","title":"给你的信","subtitle":"今天认真写给你。","sections":[{"type":"letter","text":"新的段落。"}]}',
            },
          }],
        }), { status: 200 })
      },
    })

    const result = await client.generateDesignPatch({
      currentSchema: {
        version: 1,
        theme: 'star-letter',
        palette: 'rose-gold',
        title: '给你的信',
        subtitle: '今天认真写给你。',
        sections: [{ type: 'letter', text: '旧段落。' }],
      },
      instruction: '改一下',
      assistantName: '星信',
      mbti: 'INTJ',
    })

    expect(result).toMatchObject({ title: '给你的信' })
    expect(JSON.stringify(requestBody.messages)).toContain('只返回 JSON')
  })
})
