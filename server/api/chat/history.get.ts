import { createError, defineEventHandler, getQuery } from 'h3'
import { createConversationRepository, type ConversationRecord } from '../../db/sqlite'

type StoredChatMessage = {
  role: 'user' | 'assistant'
  content: string
  imageDataUrl?: string
  parts?: unknown[]
}

export function normalizeHistoryLimit(value: unknown) {
  const limit = Number(value)

  if (!Number.isFinite(limit) || limit <= 0) {
    return 50
  }

  return Math.min(Math.floor(limit), 100)
}

function parseStoredMessage(record: ConversationRecord): StoredChatMessage | undefined {
  if (!record.messageJson) {
    return undefined
  }

  try {
    const parsed = JSON.parse(record.messageJson) as StoredChatMessage

    if (
      parsed
      && parsed.role === record.role
      && typeof parsed.content === 'string'
      && (parsed.role === 'user' || parsed.role === 'assistant')
    ) {
      return parsed
    }
  }
  catch {
    return undefined
  }
}

export function buildChatHistoryResponse(records: ConversationRecord[]) {
  return {
    messages: records
      .filter(record => record.role === 'user' || record.role === 'assistant')
      .map((record) => {
        const storedMessage = parseStoredMessage(record)

        if (storedMessage) {
          return storedMessage
        }

        return {
          role: record.role,
          content: record.content,
          ...(record.role === 'assistant'
            ? { parts: [{ type: 'text' as const, text: record.content }] }
            : {}),
        }
      }),
  }
}

export default defineEventHandler((event) => {
  const keyId = event.context.keyId

  if (!keyId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const config = useRuntimeConfig(event)
  const limit = normalizeHistoryLimit(getQuery(event).limit)
  const records = createConversationRepository(config.sqlitePath).listRecentConversationsByKey(keyId, limit)

  return buildChatHistoryResponse(records)
})
