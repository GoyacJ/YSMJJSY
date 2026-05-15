import type { ExtractedMemory } from './memory'

type Fetcher = typeof fetch

export type MiniMaxMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
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

function normalizeAudioResult(response: any): AudioResult {
  return {
    url: normalizeText(response?.data?.url ?? response?.data?.audio_url ?? response?.audio_url ?? response?.url) || undefined,
    base64: normalizeText(response?.data?.audio ?? response?.audio ?? response?.base64) || undefined,
  }
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
    })

    const text = await response.text()

    if (!response.ok) {
      throw new MiniMaxError('MiniMax request failed', response.status, text)
    }

    if (!text) {
      return {} as T
    }

    return JSON.parse(text) as T
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

    async textToSpeech(text: string): Promise<AudioResult> {
      const response = await request('/v1/t2a_v2', {
        method: 'POST',
        body: {
          model: 'speech-02-turbo',
          text,
          stream: false,
          voice_setting: {
            voice_id: 'Chinese (Mandarin)_Warm_Bestie',
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
        },
      })

      return normalizeAudioResult(response)
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

    async createVideoTask(prompt: string): Promise<VideoTaskResult> {
      const response: any = await request('/v1/video_generation', {
        method: 'POST',
        body: {
          model: 'video-01',
          prompt,
        },
      })

      return {
        providerTaskId: normalizeText(response?.task_id ?? response?.data?.task_id ?? response?.id),
      }
    },

    async getVideoTask(taskId: string): Promise<VideoStatusResult> {
      const response: any = await request(`/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`)

      return {
        status: normalizeVideoStatus(normalizeText(response?.status ?? response?.data?.status)),
        url: normalizeText(response?.file_url ?? response?.data?.file_url ?? response?.url) || undefined,
      }
    },

    async generateMusic(prompt: string): Promise<MusicResult> {
      const response = await request('/v1/music_generation', {
        method: 'POST',
        body: {
          model: 'music-2.6',
          prompt,
          output_format: 'url',
        },
      })

      return normalizeAudioResult(response)
    },
  }
}
