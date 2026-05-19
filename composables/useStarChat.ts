import { readonly, ref } from 'vue'
import { withCsrfHeaders } from './useCsrf'

export type StarChatMessage = {
  role: 'user' | 'assistant'
  content: string
  parts?: StarChatPart[]
}

export type AttachmentKind = 'image' | 'video' | 'audio'

export type StarChatPart =
  | { type: 'text'; text: string }
  | { type: 'audio'; url?: string; base64?: string }
  | { type: 'image'; url?: string; base64?: string }
  | { type: 'music'; url?: string; base64?: string; taskId?: string; providerTaskId?: string; status?: string; error?: string }
  | { type: 'video'; url?: string; base64?: string; providerTaskId?: string; status?: string }
  | { type: 'status'; text: string }
  | { type: 'tool_confirmation'; taskId: string; inboxItemId: string; title: string; summary: string; status?: 'pending' | 'submitting' | 'approved' | 'rejected' }

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
  message?: StarChatMessage
}

export type StarChatHistoryResponse = {
  messages: StarChatMessage[]
}

export type StarChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'status'; text: string }
  | { type: 'tool-status'; text: string; visibility?: 'user' | 'debug' }
  | { type: 'tool-confirmation'; taskId: string; inboxItemId: string; title: string; summary: string }
  | { type: 'message'; reply: string; message: StarChatMessage }
  | { type: 'error'; message: string }

export type StarChatStreamHandler = (event: StarChatStreamEvent) => void | Promise<void>

function parseSseEvents(buffer: string) {
  const chunks = buffer.split(/\n\n/)
  return {
    events: chunks.slice(0, -1),
    rest: chunks.at(-1) ?? '',
  }
}

export function useStarChat() {
  const messages = ref<StarChatMessage[]>([])
  const pending = ref(false)
  const error = ref('')

  function buildLocalUserParts(text: string, attachments: StarChatAttachment[]) {
    const parts: StarChatPart[] = text ? [{ type: 'text', text }] : []

    for (const attachment of attachments) {
      parts.push({
        type: attachment.kind,
        url: attachment.dataUrl,
      })
    }

    return parts
  }

  async function loadMessages(limit = 50): Promise<StarChatMessage[]> {
    try {
      const result = await $fetch<StarChatHistoryResponse>('/api/chat/history', {
        query: { limit },
      })

      messages.value = result.messages
      return result.messages
    }
    catch {
      return []
    }
  }

  async function sendMessageStream(payload: StarChatSendPayload, onEvent: StarChatStreamHandler): Promise<StarChatReply> {
    const text = payload.message.trim()

    if (!text && payload.attachments.length === 0) {
      return { reply: '' }
    }

    pending.value = true
    error.value = ''
    messages.value.push({
      role: 'user',
      content: text || '发送了一个附件',
      parts: buildLocalUserParts(text || '发送了一个附件', payload.attachments),
    })

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: withCsrfHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          message: text,
          attachments: payload.attachments,
        }),
      })

      if (!response.ok || !response.body) {
        throw new Error('Stream request failed')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalReply: StarChatReply = { reply: '' }

      while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })
        const parsed = parseSseEvents(buffer)
        buffer = parsed.rest

        for (const eventText of parsed.events) {
          for (const line of eventText.split('\n')) {
            const data = line.startsWith('data:') ? line.slice(5).trim() : ''

            if (!data || data === '[DONE]') {
              continue
            }

            const event = JSON.parse(data) as StarChatStreamEvent

            await onEvent(event)

            if (event.type === 'error') {
              throw new Error(event.message)
            }

            if (event.type === 'message') {
              finalReply = {
                reply: event.reply,
                message: event.message,
              }
              messages.value.push(event.message)
            }
          }
        }

        if (done) {
          break
        }
      }

      return finalReply
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
    loadMessages,
    sendMessageStream,
  }
}
