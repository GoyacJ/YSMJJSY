import type { ExtractedMemory } from './memory'
import { Buffer } from 'node:buffer'
import type { StarPageDesignSchema } from '../../types/design-schema'

type Fetcher = typeof fetch

export type MiniMaxMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  >
}

export type ChatResult = {
  reply: string
}

export type AudioResult = {
  url?: string
  base64?: string
}

export type ImageResult = {
  url?: string
  base64?: string
}

export type VideoTaskResult = {
  providerTaskId: string
}

export type VideoStatusResult = {
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  url?: string
}

export type MusicResult = AudioResult

export type VisionResult = {
  description: string
}

export type DesignPatchInput = {
  currentSchema: StarPageDesignSchema
  instruction: string
  assistantName: string
  mbti: string
}

export type MiniMaxQuotaKind = 'chat' | 'audio' | 'image' | 'music' | 'video'

export type MiniMaxQuotaItem = {
  key: MiniMaxQuotaKind
  label: string
  modelName: string
  used: number
  total: number
  remaining: number
  available: boolean
  resetAt?: string
}

export class MiniMaxError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly upstreamBody?: string,
  ) {
    super(message)
    this.name = 'MiniMaxError'
  }
}

type MiniMaxClientOptions = {
  apiKey: string
  groupId?: string
  baseUrl?: string
  fetcher?: Fetcher
}

type RequestOptions = {
  method?: 'GET' | 'POST'
  body?: unknown
  timeoutMs?: number
}

function toJsonBody(body: unknown) {
  return body === undefined ? undefined : JSON.stringify(body)
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function stripThinkingTags(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

function stripStreamingThinkingTags(text: string) {
  return stripThinkingTags(text).replace(/<think>[\s\S]*$/i, '').trim()
}

function extractChatStreamDelta(payload: any) {
  return normalizeText(
    payload?.choices?.[0]?.delta?.content
    ?? payload?.choices?.[0]?.message?.content
    ?? payload?.delta
    ?? payload?.text,
  )
}

function isHexAudio(value: string) {
  return value.length > 0 && value.length % 2 === 0 && /^[\da-f]+$/i.test(value)
}

function normalizeAudioValue(value: unknown) {
  const audio = normalizeText(value)

  if (!audio) {
    return {}
  }

  if (audio.startsWith('http')) {
    return { url: audio }
  }

  return {
    base64: isHexAudio(audio) ? Buffer.from(audio, 'hex').toString('base64') : audio,
  }
}

function normalizeAudioResult(response: any): AudioResult {
  const url = normalizeText(response?.data?.url ?? response?.data?.audio_url ?? response?.audio_url ?? response?.url)

  if (url) {
    return { url }
  }

  return normalizeAudioValue(response?.data?.audio ?? response?.audio ?? response?.base64)
}

function normalizeAudioHex(value: unknown) {
  return normalizeText(value)
}

function extractAudioStreamHex(payload: any) {
  return normalizeAudioHex(payload?.data?.audio ?? payload?.audio ?? payload?.base64)
}

function normalizeImageResult(response: any): ImageResult {
  const image = response?.data?.image_urls?.[0] ?? response?.data?.images?.[0] ?? response?.image_urls?.[0]

  if (typeof image === 'string') {
    return image.startsWith('http') ? { url: image } : { base64: image }
  }

  return {
    url: normalizeText(image?.url ?? response?.data?.url ?? response?.url) || undefined,
    base64: normalizeText(image?.base64 ?? response?.data?.base64 ?? response?.base64) || undefined,
  }
}

function normalizeVisionDescription(response: any) {
  return stripThinkingTags(normalizeText(
    response?.content
    ?? response?.data?.content
    ?? response?.data?.description
    ?? response?.description
    ?? response?.choices?.[0]?.message?.content,
  ))
}

function parseJsonObject(text: string) {
  const normalized = stripThinkingTags(text)
  const start = normalized.indexOf('{')
  const end = normalized.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    throw new MiniMaxError('MiniMax did not return JSON')
  }

  return JSON.parse(normalized.slice(start, end + 1))
}

function normalizeVideoStatus(status: string): VideoStatusResult['status'] {
  const normalized = status.toLowerCase()

  if (['success', 'succeeded', 'done', 'completed'].includes(normalized)) {
    return 'succeeded'
  }

  if (['fail', 'failed', 'error'].includes(normalized)) {
    return 'failed'
  }

  if (['processing', 'running'].includes(normalized)) {
    return 'processing'
  }

  return 'pending'
}

const quotaDefinitions: Array<{
  key: MiniMaxQuotaKind
  label: string
  find: (modelName: string) => boolean
}> = [
  {
    key: 'chat',
    label: '星信',
    find: modelName => modelName === 'MiniMax-M*',
  },
  {
    key: 'audio',
    label: '听一听',
    find: modelName => ['speech-hd', 'speech-2.8-hd'].includes(modelName),
  },
  {
    key: 'image',
    label: '画一张',
    find: modelName => modelName === 'image-01',
  },
  {
    key: 'music',
    label: '写一首',
    find: modelName => modelName === 'music-2.6',
  },
  {
    key: 'video',
    label: '做一段',
    find: modelName => ['MiniMax-Hailuo-2.3-6s-768p', 'MiniMax-Hailuo-2.3'].includes(modelName),
  },
]

function numberOrZero(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function resetAtFrom(value: unknown) {
  const timestamp = numberOrZero(value)
  return timestamp > 0 ? new Date(timestamp).toISOString() : undefined
}

export function normalizeTokenPlanRemains(response: any): MiniMaxQuotaItem[] {
  const remains = Array.isArray(response?.model_remains) ? response.model_remains : []

  return quotaDefinitions.map((definition) => {
    const item = remains.find((entry: any) => definition.find(normalizeText(entry?.model_name))) ?? {}
    const total = numberOrZero(item.current_interval_total_count)
    const used = numberOrZero(item.current_interval_usage_count)
    const remaining = Math.max(0, total - used)

    return {
      key: definition.key,
      label: definition.label,
      modelName: normalizeText(item.model_name),
      used,
      total,
      remaining,
      available: total > 0 && remaining > 0,
      resetAt: resetAtFrom(item.end_time),
    }
  })
}

export function createMiniMaxClient(options: MiniMaxClientOptions) {
  const baseUrl = options.baseUrl ?? 'https://api.minimaxi.com'
  const fetcher = options.fetcher ?? fetch

  async function request<T = unknown>(path: string, requestOptions: RequestOptions = {}): Promise<T> {
    const response = await fetcher(new URL(path, baseUrl), {
      method: requestOptions.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
        ...(options.groupId ? { 'X-MiniMax-Group-Id': options.groupId } : {}),
      },
      body: toJsonBody(requestOptions.body),
      signal: AbortSignal.timeout(requestOptions.timeoutMs ?? 120_000),
    })

    const text = await response.text()

    if (!response.ok) {
      throw new MiniMaxError('MiniMax request failed', response.status, text)
    }

    if (!text) {
      return {} as T
    }

    const parsed: any = JSON.parse(text)

    if (typeof parsed?.base_resp?.status_code === 'number' && parsed.base_resp.status_code !== 0) {
      throw new MiniMaxError('MiniMax provider error', parsed.base_resp.status_code, text)
    }

    return parsed as T
  }

  async function* streamChatRequest(messages: MiniMaxMessage[]): AsyncGenerator<string> {
    const response = await fetcher(new URL('/v1/chat/completions', baseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
        ...(options.groupId ? { 'X-MiniMax-Group-Id': options.groupId } : {}),
      },
      body: toJsonBody({
        model: 'MiniMax-M2.7',
        messages,
        stream: true,
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!response.ok) {
      throw new MiniMaxError('MiniMax request failed', response.status, await response.text())
    }

    if (!response.body) {
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let rawReply = ''
    let visibleReply = ''

    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const events = buffer.split(/\n\n/)
      buffer = events.pop() ?? ''

      for (const event of events) {
        for (const line of event.split('\n')) {
          const data = line.startsWith('data:') ? line.slice(5).trim() : ''

          if (!data || data === '[DONE]') {
            continue
          }

          const parsed = JSON.parse(data)

          if (typeof parsed?.base_resp?.status_code === 'number' && parsed.base_resp.status_code !== 0) {
            throw new MiniMaxError('MiniMax provider error', parsed.base_resp.status_code, data)
          }

          rawReply += extractChatStreamDelta(parsed)
          const nextVisibleReply = stripStreamingThinkingTags(rawReply)

          if (nextVisibleReply.length > visibleReply.length) {
            const delta = nextVisibleReply.slice(visibleReply.length)
            visibleReply = nextVisibleReply
            yield delta
          }
        }
      }

      if (done) {
        break
      }
    }
  }

  async function* streamJsonRequest(path: string, body: unknown, timeoutMs = 120_000): AsyncGenerator<any> {
    const response = await fetcher(new URL(path, baseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
        ...(options.groupId ? { 'X-MiniMax-Group-Id': options.groupId } : {}),
      },
      body: toJsonBody(body),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!response.ok) {
      throw new MiniMaxError('MiniMax request failed', response.status, await response.text())
    }

    if (!response.body) {
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const lines = buffer.split(/\n/)
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        const data = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed

        if (!data || data === '[DONE]') {
          continue
        }

        const parsed = JSON.parse(data)

        if (typeof parsed?.base_resp?.status_code === 'number' && parsed.base_resp.status_code !== 0) {
          throw new MiniMaxError('MiniMax provider error', parsed.base_resp.status_code, data)
        }

        yield parsed
      }

      if (done) {
        const data = buffer.trim().startsWith('data:') ? buffer.trim().slice(5).trim() : buffer.trim()

        if (data && data !== '[DONE]') {
          yield JSON.parse(data)
        }
        break
      }
    }
  }

  return {
    request,

    async chat(messages: MiniMaxMessage[]): Promise<ChatResult> {
      const response: any = await request('/v1/chat/completions', {
        method: 'POST',
        body: {
          model: 'MiniMax-M2.7',
          messages,
          stream: false,
        },
      })

      return {
        reply: stripThinkingTags(normalizeText(response?.choices?.[0]?.message?.content ?? response?.reply ?? response?.text)),
      }
    },

    chatStream(messages: MiniMaxMessage[]) {
      return streamChatRequest(messages)
    },

    async extractMemory(messages: MiniMaxMessage[]): Promise<ExtractedMemory[]> {
      const result = await this.chat(messages)

      try {
        const parsed = JSON.parse(result.reply)
        return Array.isArray(parsed) ? parsed : [parsed]
      }
      catch {
        return []
      }
    },

    async reflectAgent(messages: MiniMaxMessage[]): Promise<string> {
      const result = await this.chat(messages)
      return result.reply
    },

    async generateDesignPatch(input: DesignPatchInput): Promise<unknown> {
      const result = await this.chat([
        {
          role: 'system',
          content: [
            '你是这个 520 星信页面的设计助手。',
            `你的称呼是：${input.assistantName}`,
            `MBTI 性格设定：${input.mbti}`,
            '只返回 JSON。',
            '不要返回 Markdown。',
            '不要返回 HTML、CSS、JavaScript 或解释。',
            '只能输出符合 StarPageDesignSchema 的完整对象。',
            '允许字段：version、theme、palette、title、subtitle、sections。',
            'section 只能是 letter、memory-map、star-scene。',
            '保持温柔、安静、像一封信，带一点星空仪式感。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `当前 schema：${JSON.stringify(input.currentSchema)}`,
            `修改要求：${input.instruction}`,
          ].join('\n\n'),
        },
      ])

      return parseJsonObject(result.reply)
    },

    async textToSpeech(text: string): Promise<AudioResult> {
      const response = await request('/v1/t2a_v2', {
        method: 'POST',
        body: {
          model: 'speech-2.8-hd',
          text,
          stream: false,
          voice_setting: {
            voice_id: 'male-qn-qingse',
            speed: 0.95,
            vol: 1,
            pitch: 0,
          },
          audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: 'mp3',
            channel: 1,
          },
          output_format: 'url',
        },
      })

      return normalizeAudioResult(response)
    },

    async *textToSpeechStream(text: string): AsyncGenerator<string> {
      for await (const chunk of streamJsonRequest('/v1/t2a_v2', {
        model: 'speech-2.8-hd',
        text,
        stream: true,
        voice_setting: {
          voice_id: 'male-qn-qingse',
          speed: 0.95,
          vol: 1,
          pitch: 0,
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: 'mp3',
          channel: 1,
        },
        output_format: 'hex',
      })) {
        const hex = extractAudioStreamHex(chunk)

        if (hex) {
          yield hex
        }
      }
    },

    async generateImage(prompt: string): Promise<ImageResult> {
      const response = await request('/v1/image_generation', {
        method: 'POST',
        body: {
          model: 'image-01',
          prompt,
          aspect_ratio: '16:9',
          response_format: 'url',
        },
      })

      return normalizeImageResult(response)
    },

    async describeImage(imageDataUrl: string, prompt: string): Promise<string> {
      const response = await request('/v1/coding_plan/vlm', {
        method: 'POST',
        body: {
          prompt,
          image_url: imageDataUrl,
        },
      })

      return normalizeVisionDescription(response)
    },

    async createVideoTask(prompt: string): Promise<VideoTaskResult> {
      const response: any = await request('/v1/video_generation', {
        method: 'POST',
        body: {
          model: 'MiniMax-Hailuo-2.3',
          prompt,
          duration: 6,
          resolution: '768P',
        },
      })

      return {
        providerTaskId: normalizeText(response?.task_id ?? response?.data?.task_id ?? response?.id),
      }
    },

    async getVideoTask(taskId: string): Promise<VideoStatusResult> {
      const response: any = await request(`/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`)
      const status = normalizeVideoStatus(normalizeText(response?.status ?? response?.data?.status))
      const directUrl = normalizeText(response?.file_url ?? response?.data?.file_url ?? response?.url)
      const fileId = normalizeText(response?.file_id ?? response?.data?.file_id)

      if (status === 'succeeded' && !directUrl && fileId) {
        const fileResponse: any = await request(`/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`)
        return {
          status,
          url: normalizeText(fileResponse?.file?.download_url ?? fileResponse?.download_url) || undefined,
        }
      }

      return {
        status,
        url: directUrl || undefined,
      }
    },

    async generateMusic(prompt: string): Promise<MusicResult> {
      const response = await request('/v1/music_generation', {
        method: 'POST',
        timeoutMs: 180_000,
        body: {
          model: 'music-2.6',
          prompt,
          is_instrumental: true,
          output_format: 'url',
          audio_setting: {
            sample_rate: 44100,
            bitrate: 256000,
            format: 'mp3',
          },
        },
      })

      return normalizeAudioResult(response)
    },

    async *generateMusicStream(prompt: string): AsyncGenerator<string> {
      for await (const chunk of streamJsonRequest('/v1/music_generation', {
        model: 'music-2.6',
        prompt,
        stream: true,
        is_instrumental: true,
        output_format: 'hex',
        audio_setting: {
          sample_rate: 44100,
          bitrate: 256000,
          format: 'mp3',
        },
      }, 180_000)) {
        const hex = extractAudioStreamHex(chunk)

        if (hex) {
          yield hex
        }
      }
    },

    async getTokenPlanRemains(): Promise<MiniMaxQuotaItem[]> {
      const response = await request('https://www.minimaxi.com/v1/token_plan/remains')
      return normalizeTokenPlanRemains(response)
    },
  }
}
