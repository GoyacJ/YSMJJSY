import { readonly, ref } from 'vue'

export type StarChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type StarChatReply = {
  reply: string
}

export function useStarChat() {
  const messages = ref<StarChatMessage[]>([])
  const pending = ref(false)
  const error = ref('')

  async function sendMessage(message: string): Promise<StarChatReply> {
    const text = message.trim()

    if (!text) {
      return { reply: '' }
    }

    pending.value = true
    error.value = ''
    messages.value.push({ role: 'user', content: text })

    try {
      const result = await $fetch<StarChatReply>('/api/chat', {
        method: 'POST',
        body: { message: text },
      })

      messages.value.push({ role: 'assistant', content: result.reply })
      return result
    }
    catch {
      error.value = '星信刚刚走神了，等一下再试。'
      return { reply: '' }
    }
    finally {
      pending.value = false
    }
  }

  return {
    messages: readonly(messages),
    pending: readonly(pending),
    error: readonly(error),
    sendMessage,
  }
}
