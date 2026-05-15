import Database from 'better-sqlite3'
import { dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
import { schemaStatements } from './schema'

export type ConversationRecord = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

export type MemoryRecord = {
  id: string
  type: 'emotion' | 'preference'
  content: string
  importance: number
  createdAt: string
}

export type MediaTaskRecord = {
  id: string
  type: 'tts' | 'image' | 'video' | 'music'
  providerTaskId?: string | null
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  prompt: string
  resultUrl?: string | null
  error?: string | null
  createdAt: string
  updatedAt: string
}

function openDatabase(path: string) {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }

  const db = new Database(path)

  for (const statement of schemaStatements) {
    db.prepare(statement).run()
  }

  return db
}

export function createConversationRepository(path: string) {
  const db = openDatabase(path)

  return {
    addConversation(record: ConversationRecord) {
      db.prepare(`
        INSERT INTO conversations (id, role, content, created_at)
        VALUES (@id, @role, @content, @createdAt)
      `).run(record)
    },

    listRecentConversations(limit = 12): ConversationRecord[] {
      return db.prepare(`
        SELECT id, role, content, created_at AS createdAt
        FROM conversations
        ORDER BY created_at DESC
        LIMIT ?
      `).all(limit).reverse() as ConversationRecord[]
    },
  }
}

export function createMemoryRepository(path: string) {
  const db = openDatabase(path)

  return {
    addMemory(record: MemoryRecord) {
      db.prepare(`
        INSERT INTO memories (id, type, content, importance, created_at)
        VALUES (@id, @type, @content, @importance, @createdAt)
      `).run(record)
    },

    listMemories(): MemoryRecord[] {
      return db.prepare(`
        SELECT id, type, content, importance, created_at AS createdAt
        FROM memories
        ORDER BY importance DESC, created_at DESC
      `).all() as MemoryRecord[]
    },
  }
}

export function createMediaTaskRepository(path: string) {
  const db = openDatabase(path)

  return {
    addMediaTask(record: MediaTaskRecord) {
      db.prepare(`
        INSERT INTO media_tasks (
          id, type, provider_task_id, status, prompt, result_url, error, created_at, updated_at
        )
        VALUES (
          @id, @type, @providerTaskId, @status, @prompt, @resultUrl, @error, @createdAt, @updatedAt
        )
      `).run(record)
    },

    getMediaTask(id: string): MediaTaskRecord | undefined {
      return db.prepare(`
        SELECT
          id,
          type,
          provider_task_id AS providerTaskId,
          status,
          prompt,
          result_url AS resultUrl,
          error,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM media_tasks
        WHERE id = ?
      `).get(id) as MediaTaskRecord | undefined
    },

    updateMediaTask(id: string, updates: Partial<Pick<MediaTaskRecord, 'providerTaskId' | 'status' | 'resultUrl' | 'error' | 'updatedAt'>>) {
      const current = this.getMediaTask(id)

      if (!current) {
        return
      }

      db.prepare(`
        UPDATE media_tasks
        SET
          provider_task_id = @providerTaskId,
          status = @status,
          result_url = @resultUrl,
          error = @error,
          updated_at = @updatedAt
        WHERE id = @id
      `).run({
        id,
        providerTaskId: updates.providerTaskId ?? current.providerTaskId ?? null,
        status: updates.status ?? current.status,
        resultUrl: updates.resultUrl ?? current.resultUrl ?? null,
        error: updates.error ?? current.error ?? null,
        updatedAt: updates.updatedAt ?? new Date().toISOString(),
      })
    },
  }
}
