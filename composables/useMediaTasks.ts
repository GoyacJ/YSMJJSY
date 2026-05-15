export type GeneratedAssetKind = 'audio' | 'image' | 'video' | 'music'

export type GeneratedAssetItem = {
  id: string
  kind: GeneratedAssetKind
  status: 'pending' | 'succeeded' | 'failed'
  url?: string
  base64?: string
  error?: string
}

export function useMediaTasks() {
  async function createSpeech(text: string) {
    return $fetch<{ url?: string; base64?: string }>('/api/tts', {
      method: 'POST',
      body: { text },
    })
  }

  async function createImage(prompt: string) {
    return $fetch<{ url?: string; base64?: string }>('/api/image', {
      method: 'POST',
      body: { prompt },
    })
  }

  async function createVideo(prompt: string) {
    return $fetch<{ taskId: string }>('/api/video/tasks', {
      method: 'POST',
      body: { prompt },
    })
  }

  async function pollVideoTask(id: string) {
    return $fetch<{ status: GeneratedAssetItem['status']; url?: string; error?: string }>(`/api/video/tasks/${id}`)
  }

  async function createMusic(prompt: string) {
    return $fetch<{ url?: string; base64?: string }>('/api/music', {
      method: 'POST',
      body: { prompt },
    })
  }

  return {
    createSpeech,
    createImage,
    createVideo,
    pollVideoTask,
    createMusic,
  }
}
