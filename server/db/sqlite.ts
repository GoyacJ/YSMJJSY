import Database from 'better-sqlite3'
import { dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
import { schemaStatements } from './schema'

export type ConversationRecord = {
  id: string
  keyId?: string | null
  role: 'user' | 'assistant' | 'system'
  content: string
  messageJson?: string | null
  createdAt: string
}

export type MemoryRecord = {
  id: string
  keyId?: string | null
  type: 'emotion' | 'preference'
  content: string
  importance: number
  createdAt: string
}

export type MediaTaskRecord = {
  id: string
  keyId?: string | null
  type: 'tts' | 'image' | 'video' | 'music'
  providerTaskId?: string | null
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  prompt: string
  resultUrl?: string | null
  error?: string | null
  createdAt: string
  updatedAt: string
}

export type KeyActivityKind = 'created' | 'profile' | 'chat' | 'design' | 'media'

export type PublicStarRecord = {
  id: string
  name: string
  mbti: string
  createdAt: string
  activityAt?: string | null
  activityKind?: KeyActivityKind | null
}

export type KeyProfileRecord = {
  id: string
  keyLookupHash: string
  assistantName: string
  mbti: string
  configuredAt?: string | null
  createdIpHash: string
  createdAt: string
  updatedAt: string
  activityAt?: string | null
  activityKind?: KeyActivityKind | null
}

export type KeyDesignRecord = {
  keyId: string
  version: number
  schemaJson: string
  prompt: string
  createdAt: string
}

export type UsageBucket = 'create' | 'chat' | 'design' | 'upload'

export type UsageLimitRecord = {
  keyId: string
  ipHash: string
  date: string
  createCount: number
  chatCount: number
  designCount: number
  uploadCount: number
}

export type AttachmentRecord = {
  id: string
  keyId: string
  conversationId?: string | null
  type: 'image' | 'video' | 'audio'
  mimeType: string
  filename: string
  dataUrl: string
  createdAt: string
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>

  if (!columns.some(item => item.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run()
  }
}

function openDatabase(path: string) {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }

  const db = new Database(path)

  for (const statement of schemaStatements) {
    db.prepare(statement).run()
  }

  ensureColumn(db, 'conversations', 'key_id', 'TEXT')
  ensureColumn(db, 'conversations', 'message_json', 'TEXT')
  ensureColumn(db, 'memories', 'key_id', 'TEXT')
  ensureColumn(db, 'media_tasks', 'key_id', 'TEXT')
  ensureColumn(db, 'key_profiles', 'activity_at', 'TEXT')
  ensureColumn(db, 'key_profiles', 'activity_kind', 'TEXT')

  return db
}

export function createConversationRepository(path: string) {
  const db = openDatabase(path)

  return {
    addConversation(record: ConversationRecord) {
      db.prepare(`
        INSERT INTO conversations (id, key_id, role, content, message_json, created_at)
        VALUES (@id, @keyId, @role, @content, @messageJson, @createdAt)
      `).run({ ...record, keyId: record.keyId ?? null, messageJson: record.messageJson ?? null })
    },

    listRecentConversations(limit = 12): ConversationRecord[] {
      return db.prepare(`
        SELECT id, key_id AS keyId, role, content, message_json AS messageJson, created_at AS createdAt
        FROM conversations
        ORDER BY created_at DESC
        LIMIT ?
      `).all(limit).reverse() as ConversationRecord[]
    },

    listRecentConversationsByKey(keyId: string, limit = 12): ConversationRecord[] {
      return db.prepare(`
        SELECT id, key_id AS keyId, role, content, message_json AS messageJson, created_at AS createdAt
        FROM conversations
        WHERE key_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(keyId, limit).reverse() as ConversationRecord[]
    },
  }
}

export function createMemoryRepository(path: string) {
  const db = openDatabase(path)

  return {
    addMemory(record: MemoryRecord) {
      db.prepare(`
        INSERT INTO memories (id, key_id, type, content, importance, created_at)
        VALUES (@id, @keyId, @type, @content, @importance, @createdAt)
      `).run({ ...record, keyId: record.keyId ?? null })
    },

    listMemories(): MemoryRecord[] {
      return db.prepare(`
        SELECT id, key_id AS keyId, type, content, importance, created_at AS createdAt
        FROM memories
        ORDER BY importance DESC, created_at DESC
      `).all() as MemoryRecord[]
    },

    listMemoriesByKey(keyId: string): MemoryRecord[] {
      return db.prepare(`
        SELECT id, key_id AS keyId, type, content, importance, created_at AS createdAt
        FROM memories
        WHERE key_id = ?
        ORDER BY importance DESC, created_at DESC
      `).all(keyId) as MemoryRecord[]
    },
  }
}

export function createMediaTaskRepository(path: string) {
  const db = openDatabase(path)

  return {
    addMediaTask(record: MediaTaskRecord) {
      db.prepare(`
        INSERT INTO media_tasks (
          id, key_id, type, provider_task_id, status, prompt, result_url, error, created_at, updated_at
        )
        VALUES (
          @id, @keyId, @type, @providerTaskId, @status, @prompt, @resultUrl, @error, @createdAt, @updatedAt
        )
      `).run({ ...record, keyId: record.keyId ?? null })
    },

    getMediaTask(id: string): MediaTaskRecord | undefined {
      return db.prepare(`
        SELECT
          id,
          key_id AS keyId,
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

    getMediaTaskByKey(keyId: string, id: string): MediaTaskRecord | undefined {
      return db.prepare(`
        SELECT
          id,
          key_id AS keyId,
          type,
          provider_task_id AS providerTaskId,
          status,
          prompt,
          result_url AS resultUrl,
          error,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM media_tasks
        WHERE key_id = ? AND id = ?
      `).get(keyId, id) as MediaTaskRecord | undefined
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

export function createKeyProfileRepository(path: string) {
  const db = openDatabase(path)

  return {
    addKeyProfile(record: KeyProfileRecord) {
      db.prepare(`
        INSERT INTO key_profiles (
          id,
          key_lookup_hash,
          assistant_name,
          mbti,
          configured_at,
          created_ip_hash,
          created_at,
          updated_at,
          activity_at,
          activity_kind
        )
        VALUES (
          @id,
          @keyLookupHash,
          @assistantName,
          @mbti,
          @configuredAt,
          @createdIpHash,
          @createdAt,
          @updatedAt,
          @activityAt,
          @activityKind
        )
      `).run({
        ...record,
        configuredAt: record.configuredAt ?? null,
        activityAt: record.activityAt ?? null,
        activityKind: record.activityKind ?? null,
      })
    },

    findByLookupHash(keyLookupHash: string): KeyProfileRecord | undefined {
      return db.prepare(`
        SELECT
          id,
          key_lookup_hash AS keyLookupHash,
          assistant_name AS assistantName,
          mbti,
          configured_at AS configuredAt,
          created_ip_hash AS createdIpHash,
          created_at AS createdAt,
          updated_at AS updatedAt,
          activity_at AS activityAt,
          activity_kind AS activityKind
        FROM key_profiles
        WHERE key_lookup_hash = ?
      `).get(keyLookupHash) as KeyProfileRecord | undefined
    },

    getKeyProfile(id: string): KeyProfileRecord | undefined {
      return db.prepare(`
        SELECT
          id,
          key_lookup_hash AS keyLookupHash,
          assistant_name AS assistantName,
          mbti,
          configured_at AS configuredAt,
          created_ip_hash AS createdIpHash,
          created_at AS createdAt,
          updated_at AS updatedAt,
          activity_at AS activityAt,
          activity_kind AS activityKind
        FROM key_profiles
        WHERE id = ?
      `).get(id) as KeyProfileRecord | undefined
    },

    updateKeyProfile(id: string, updates: Pick<KeyProfileRecord, 'assistantName' | 'mbti' | 'configuredAt' | 'updatedAt'>) {
      db.prepare(`
        UPDATE key_profiles
        SET assistant_name = @assistantName,
            mbti = @mbti,
            configured_at = @configuredAt,
            updated_at = @updatedAt
        WHERE id = @id
      `).run({ id, ...updates, configuredAt: updates.configuredAt ?? null })
    },

    listPublicStars(limit = 80): PublicStarRecord[] {
      return db.prepare(`
        SELECT
          id,
          assistant_name AS name,
          mbti,
          created_at AS createdAt,
          activity_at AS activityAt,
          activity_kind AS activityKind
        FROM key_profiles
        WHERE configured_at IS NOT NULL
          AND assistant_name <> ''
        ORDER BY COALESCE(activity_at, configured_at, created_at) DESC
        LIMIT ?
      `).all(limit) as PublicStarRecord[]
    },

    markKeyActivity(id: string, updates: { activityAt: string, activityKind: KeyActivityKind }) {
      db.prepare(`
        UPDATE key_profiles
        SET activity_at = @activityAt,
            activity_kind = @activityKind,
            updated_at = @activityAt
        WHERE id = @id
      `).run({ id, ...updates })
    },
  }
}

export function createKeyDesignRepository(path: string) {
  const db = openDatabase(path)

  return {
    addKeyDesign(record: KeyDesignRecord) {
      db.prepare(`
        INSERT INTO key_designs (key_id, version, schema_json, prompt, created_at)
        VALUES (@keyId, @version, @schemaJson, @prompt, @createdAt)
      `).run(record)
    },

    getLatestDesign(keyId: string): KeyDesignRecord | undefined {
      return db.prepare(`
        SELECT key_id AS keyId, version, schema_json AS schemaJson, prompt, created_at AS createdAt
        FROM key_designs
        WHERE key_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(keyId) as KeyDesignRecord | undefined
    },
  }
}

export function createUsageLimitRepository(path: string) {
  const db = openDatabase(path)

  function getUsageByIp(keyId: string, ipHash: string, date: string): UsageLimitRecord | undefined {
    return db.prepare(`
      SELECT
        key_id AS keyId,
        ip_hash AS ipHash,
        date,
        create_count AS createCount,
        chat_count AS chatCount,
        design_count AS designCount,
        upload_count AS uploadCount
      FROM key_usage_limits
      WHERE key_id = ? AND ip_hash = ? AND date = ?
    `).get(keyId, ipHash, date) as UsageLimitRecord | undefined
  }

  return {
    getUsage(keyId: string, date: string): UsageLimitRecord | undefined {
      return db.prepare(`
        SELECT
          key_id AS keyId,
          ip_hash AS ipHash,
          date,
          SUM(create_count) AS createCount,
          SUM(chat_count) AS chatCount,
          SUM(design_count) AS designCount,
          SUM(upload_count) AS uploadCount
        FROM key_usage_limits
        WHERE key_id = ? AND date = ?
        GROUP BY key_id, date
      `).get(keyId, date) as UsageLimitRecord | undefined
    },

    getUsageByIp,

    incrementUsage(input: { keyId: string, ipHash: string, date: string, bucket: UsageBucket }) {
      const columnByBucket: Record<UsageBucket, string> = {
        create: 'create_count',
        chat: 'chat_count',
        design: 'design_count',
        upload: 'upload_count',
      }
      const column = columnByBucket[input.bucket]

      db.prepare(`
        INSERT INTO key_usage_limits (key_id, ip_hash, date, ${column})
        VALUES (@keyId, @ipHash, @date, 1)
        ON CONFLICT(key_id, ip_hash, date)
        DO UPDATE SET ${column} = ${column} + 1
      `).run(input)
    },
  }
}

export function createAttachmentRepository(path: string) {
  const db = openDatabase(path)

  return {
    addAttachment(record: AttachmentRecord) {
      db.prepare(`
        INSERT INTO attachments (
          id, key_id, conversation_id, type, mime_type, filename, data_url, created_at
        )
        VALUES (
          @id, @keyId, @conversationId, @type, @mimeType, @filename, @dataUrl, @createdAt
        )
      `).run({ ...record, conversationId: record.conversationId ?? null })
    },

    listAttachmentsByConversation(keyId: string, conversationId: string): AttachmentRecord[] {
      return db.prepare(`
        SELECT
          id,
          key_id AS keyId,
          conversation_id AS conversationId,
          type,
          mime_type AS mimeType,
          filename,
          data_url AS dataUrl,
          created_at AS createdAt
        FROM attachments
        WHERE key_id = ? AND conversation_id = ?
        ORDER BY created_at ASC
      `).all(keyId, conversationId) as AttachmentRecord[]
    },
  }
}
