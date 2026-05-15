import { readonly, ref } from 'vue'

export type StarChatMessage = {
  role: 'user' | 'assistant'
  content: string
  imageDataUrl?: string
}

export type AttachmentKind = 'image' | 'video' | 'audio'

export type StarChatAttachment = {
  kind: AttachmentKind
  dataUrl: string
  name: string
  mimeType: string
}

export type StarChatSendPayload = {
  message: string
  attachments: StarChatAttachment[]
}

export type StarChatReply = {
  reply: string
}

export function useStarChat() {
  const messages = ref<StarChatMessage[]>([])
  const pending = ref(false)
  const error = ref('')

  async function sendMessage(payload: StarChatSendPayload): Promise<StarChatReply> {
    const text = payload.message.trim()
    const image = payload.attachments.find(attachment => attachment.kind === 'image')

    if (!text && payload.attachments.length === 0) {
      return { reply: '' }
    }

    pending.value = true
    error.value = ''
    messages.value.push({ role: 'user', content: text || '发送了一个附件', imageDataUrl: image?.dataUrl })

    try {
      const result = await $fetch<StarChatReply>('/api/chat', {
        method: 'POST',
        body: {
          message: text,
          attachments: payload.attachments,
          imageDataUrl: image?.dataUrl,
        },
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
