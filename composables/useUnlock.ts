export type UnlockResult = {
  ok: boolean
}

export function useUnlock() {
  const pending = ref(false)
  const error = ref('')

  async function unlock(code: string): Promise<UnlockResult> {
    pending.value = true
    error.value = ''

    try {
      const result = await $fetch<UnlockResult>('/api/unlock', {
        method: 'POST',
        body: { code },
      })

      return result
    }
    catch {
      error.value = '这不是这封信的钥匙。'
      return { ok: false }
    }
    finally {
      pending.value = false
    }
  }

  return {
    pending: readonly(pending),
    error: readonly(error),
    unlock,
  }
}
