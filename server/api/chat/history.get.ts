import { createError, defineEventHandler, getQuery } from 'h3'
import { createConversationRepository, createMediaTaskRepository, type ConversationRecord, type MediaTaskRecord } from '../../db/sqlite'

type StoredChatMessage = {
  role: 'user' | 'assistant'
  content: string
  parts?: unknown[]
}

type ChatHistoryHydrationOptions = {
  keyId?: string
  mediaTasks?: {
    getMediaTaskByKey: (keyId: string, id: string) => MediaTaskRecord | undefined
  }
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

function hydrateAsyncMediaPart(part: unknown, options?: ChatHistoryHydrationOptions) {
  if (
    !part
    || typeof part !== 'object'
    || Array.isArray(part)
    || !options?.keyId
    || !options.mediaTasks
  ) {
    return part
  }

  const record = part as { type?: unknown, taskId?: unknown, status?: unknown }

  if (record.type !== 'music' || typeof record.taskId !== 'string' || record.status !== 'processing') {
    return part
  }

  const task = options.mediaTasks.getMediaTaskByKey(options.keyId, record.taskId)

  if (!task) {
    return part
  }

  if (task.status === 'succeeded' && task.resultUrl) {
    return {
      ...record,
      status: 'succeeded',
      ...(task.providerTaskId ? { providerTaskId: task.providerTaskId } : {}),
      url: task.resultUrl,
    }
  }

  if (task.status === 'failed') {
    return {
      ...record,
      status: 'failed',
      ...(task.error ? { error: task.error } : {}),
    }
  }

  return part
}

function hydrateStoredMessage(message: StoredChatMessage, options?: ChatHistoryHydrationOptions) {
  if (!message.parts?.length) {
    return message
  }

  return {
    ...message,
    parts: message.parts.map(part => hydrateAsyncMediaPart(part, options)),
  }
}

export function buildChatHistoryResponse(records: ConversationRecord[], options?: ChatHistoryHydrationOptions) {
  return {
    messages: records
      .filter(record => record.role === 'user' || record.role === 'assistant')
      .map((record) => {
        const storedMessage = parseStoredMessage(record)

        if (storedMessage) {
          return hydrateStoredMessage(storedMessage, options)
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

  return buildChatHistoryResponse(records, {
    keyId,
    mediaTasks: createMediaTaskRepository(config.sqlitePath),
  })
})
