import { readonly, ref } from 'vue'
import type { StarPageDesignSchema } from '../types/design-schema'

type DesignLoadResponse = {
  schema: StarPageDesignSchema
  version: number
}

export function useKeyDesign() {
  const currentSchema = ref<StarPageDesignSchema | null>(null)
  const previewSchema = ref<StarPageDesignSchema | null>(null)
  const pending = ref(false)
  const error = ref('')
  const lastPrompt = ref('')

  async function loadDesign() {
    pending.value = true
    error.value = ''

    try {
      const result = await $fetch<DesignLoadResponse>('/api/design')
      currentSchema.value = result.schema
      return result.schema
    }
    catch {
      error.value = '页面设计没有加载成功。'
      return null
    }
    finally {
      pending.value = false
    }
  }

  async function previewDesign(instruction: string) {
    const text = instruction.trim()

    if (!text) {
      return null
    }

    pending.value = true
    error.value = ''
    lastPrompt.value = text

    try {
      const result = await $fetch<{ schema: StarPageDesignSchema }>('/api/design/preview', {
        method: 'POST',
        body: { instruction: text },
      })
      previewSchema.value = result.schema
      return result.schema
    }
    catch {
      error.value = '设计预览没有生成成功。'
      return null
    }
    finally {
      pending.value = false
    }
  }

  async function commitDesign(prompt = lastPrompt.value) {
    if (!previewSchema.value) {
      return false
    }

    pending.value = true
    error.value = ''

    try {
      await $fetch('/api/design/commit', {
        method: 'POST',
        body: {
          schema: previewSchema.value,
          prompt,
        },
      })
      currentSchema.value = previewSchema.value
      previewSchema.value = null
      return true
    }
    catch {
      error.value = '设计没有保存成功。'
      return false
    }
    finally {
      pending.value = false
    }
  }

  function discardPreview() {
    previewSchema.value = null
  }

  return {
    currentSchema: readonly(currentSchema),
    previewSchema: readonly(previewSchema),
    pending: readonly(pending),
    error: readonly(error),
    loadDesign,
    previewDesign,
    commitDesign,
    discardPreview,
  }
}
