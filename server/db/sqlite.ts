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
  type: 'emotion' | 'preference' | 'event' | 'person' | 'creative_asset'
  content: string
  importance: number
  confidence?: number
  sourceConversationId?: string | null
  sourceAttachmentId?: string | null
  status?: 'active' | 'archived' | 'rejected'
  updatedAt?: string | null
  createdAt: string
}

export type MemoryGovernanceAction = 'confirm' | 'downgrade' | 'archive' | 'reject'

export type MemoryEventRecord = {
  id: string
  keyId: string
  memoryId: string
  action: MemoryGovernanceAction
  beforeJson: string
  afterJson: string
  reason: string
  createdAt: string
}

export type AgentReflectionRecord = {
  id: string
  keyId: string
  conversationId?: string | null
  summary: string
  rawJson: string
  createdAt: string
}

export type AgentEvolutionProposalRecord = {
  id: string
  keyId: string
  reflectionId?: string | null
  type: 'tone' | 'relationship_role' | 'content_strategy' | 'memory_weight' | 'page_design'
  title: string
  summary: string
  payloadJson: string
  status: 'pending' | 'accepted' | 'rejected' | 'applied'
  createdAt: string
  updatedAt: string
}

export type AgentStateSnapshotRecord = {
  id: string
  keyId: string
  proposalId?: string | null
  profileJson: string
  createdAt: string
}

export type AgentContentStrategy = {
  replyLength?: 'short' | 'balanced' | 'rich'
  structure?: 'plain' | 'letter' | 'checklist'
  initiative?: 'low' | 'medium'
}

export type AgentStateRecord = {
  keyId: string
  tone: string
  relationshipRole: string
  learningMode: 'manual' | 'assisted' | 'auto'
  contentStrategy: AgentContentStrategy
  lastSleepAt?: string | null
  nextSleepAt?: string | null
  updatedAt: string
}

export type AgentSleepRunRecord = {
  id: string
  keyId: string
  status: 'running' | 'completed' | 'failed'
  summary: string
  rawJson: string
  memoryActionsJson?: string | null
  workIdeasJson?: string | null
  nextConversationHintsJson?: string | null
  startedAt: string
  completedAt?: string | null
  error?: string | null
}

export type AgentWorkType = 'letter' | 'image' | 'music' | 'video' | 'page_design'
export type AgentWorkVisibility = 'private' | 'public'

export type AgentWorkRecord = {
  id: string
  keyId: string
  type: AgentWorkType
  title: string
  summary: string
  sourceConversationId?: string | null
  sourceMediaTaskId?: string | null
  sourceDesignVersion?: number | null
  previewUrl?: string | null
  payloadJson: string
  visibility: AgentWorkVisibility
  createdAt: string
  updatedAt: string
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
  publicWorks?: Array<Pick<AgentWorkRecord, 'id' | 'type' | 'title' | 'summary'>>
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
  ensureColumn(db, 'memories', 'confidence', 'REAL NOT NULL DEFAULT 1')
  ensureColumn(db, 'memories', 'source_conversation_id', 'TEXT')
  ensureColumn(db, 'memories', 'source_attachment_id', 'TEXT')
  ensureColumn(db, 'memories', 'status', `TEXT NOT NULL DEFAULT 'active'`)
  ensureColumn(db, 'memories', 'updated_at', 'TEXT')
  ensureColumn(db, 'media_tasks', 'key_id', 'TEXT')
  ensureColumn(db, 'key_profiles', 'activity_at', 'TEXT')
  ensureColumn(db, 'key_profiles', 'activity_kind', 'TEXT')
  ensureColumn(db, 'agent_sleep_runs', 'memory_actions_json', 'TEXT')
  ensureColumn(db, 'agent_sleep_runs', 'work_ideas_json', 'TEXT')
  ensureColumn(db, 'agent_sleep_runs', 'next_conversation_hints_json', 'TEXT')

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

    getConversationByKey(keyId: string, id: string): ConversationRecord | undefined {
      return db.prepare(`
        SELECT id, key_id AS keyId, role, content, message_json AS messageJson, created_at AS createdAt
        FROM conversations
        WHERE key_id = ? AND id = ?
      `).get(keyId, id) as ConversationRecord | undefined
    },
  }
}

export function createMemoryRepository(path: string) {
  const db = openDatabase(path)

  return {
    addMemory(record: MemoryRecord) {
      db.prepare(`
        INSERT INTO memories (
          id,
          key_id,
          type,
          content,
          importance,
          confidence,
          source_conversation_id,
          source_attachment_id,
          status,
          updated_at,
          created_at
        )
        VALUES (
          @id,
          @keyId,
          @type,
          @content,
          @importance,
          @confidence,
          @sourceConversationId,
          @sourceAttachmentId,
          @status,
          @updatedAt,
          @createdAt
        )
      `).run({
        ...record,
        keyId: record.keyId ?? null,
        confidence: record.confidence ?? 1,
        sourceConversationId: record.sourceConversationId ?? null,
        sourceAttachmentId: record.sourceAttachmentId ?? null,
        status: record.status ?? 'active',
        updatedAt: record.updatedAt ?? null,
      })
    },

    listMemories(): MemoryRecord[] {
      return db.prepare(`
        SELECT
          id,
          key_id AS keyId,
          type,
          content,
          importance,
          confidence,
          source_conversation_id AS sourceConversationId,
          source_attachment_id AS sourceAttachmentId,
          status,
          updated_at AS updatedAt,
          created_at AS createdAt
        FROM memories
        ORDER BY importance DESC, created_at DESC
      `).all() as MemoryRecord[]
    },

    listMemoriesByKey(keyId: string): MemoryRecord[] {
      return db.prepare(`
        SELECT
          id,
          key_id AS keyId,
          type,
          content,
          importance,
          confidence,
          source_conversation_id AS sourceConversationId,
          source_attachment_id AS sourceAttachmentId,
          status,
          updated_at AS updatedAt,
          created_at AS createdAt
        FROM memories
        WHERE key_id = ?
        ORDER BY importance DESC, created_at DESC
      `).all(keyId) as MemoryRecord[]
    },

    getMemoryByKey(keyId: string, id: string): MemoryRecord | undefined {
      return db.prepare(`
        SELECT
          id,
          key_id AS keyId,
          type,
          content,
          importance,
          confidence,
          source_conversation_id AS sourceConversationId,
          source_attachment_id AS sourceAttachmentId,
          status,
          updated_at AS updatedAt,
          created_at AS createdAt
        FROM memories
        WHERE key_id = ? AND id = ?
      `).get(keyId, id) as MemoryRecord | undefined
    },

    updateMemory(id: string, updates: {
      importance?: number
      status?: 'active' | 'archived' | 'rejected'
      updatedAt: string
    }) {
      const current = db.prepare(`
        SELECT
          id,
          key_id AS keyId,
          type,
          content,
          importance,
          confidence,
          source_conversation_id AS sourceConversationId,
          source_attachment_id AS sourceAttachmentId,
          status,
          updated_at AS updatedAt,
          created_at AS createdAt
        FROM memories
        WHERE id = ?
      `).get(id) as MemoryRecord | undefined

      if (!current) {
        return
      }

      db.prepare(`
        UPDATE memories
        SET
          importance = @importance,
          status = @status,
          updated_at = @updatedAt
        WHERE id = @id
      `).run({
        id,
        importance: updates.importance ?? current.importance,
        status: updates.status ?? current.status ?? 'active',
        updatedAt: updates.updatedAt,
      })
    },
  }
}

export function createMemoryEventRepository(path: string) {
  const db = openDatabase(path)

  return {
    addMemoryEvent(record: MemoryEventRecord) {
      db.prepare(`
        INSERT INTO memory_events (
          id,
          key_id,
          memory_id,
          action,
          before_json,
          after_json,
          reason,
          created_at
        )
        VALUES (
          @id,
          @keyId,
          @memoryId,
          @action,
          @beforeJson,
          @afterJson,
          @reason,
          @createdAt
        )
      `).run(record)
    },

    listMemoryEventsByKey(keyId: string): MemoryEventRecord[] {
      return db.prepare(`
        SELECT
          id,
          key_id AS keyId,
          memory_id AS memoryId,
          action,
          before_json AS beforeJson,
          after_json AS afterJson,
          reason,
          created_at AS createdAt
        FROM memory_events
        WHERE key_id = ?
        ORDER BY created_at DESC
      `).all(keyId) as MemoryEventRecord[]
    },

    listMemoryEventsByMemory(memoryId: string): MemoryEventRecord[] {
      return db.prepare(`
        SELECT
          id,
          key_id AS keyId,
          memory_id AS memoryId,
          action,
          before_json AS beforeJson,
          after_json AS afterJson,
          reason,
          created_at AS createdAt
        FROM memory_events
        WHERE memory_id = ?
        ORDER BY created_at DESC
      `).all(memoryId) as MemoryEventRecord[]
    },
  }
}

export function createAgentReflectionRepository(path: string) {
  const db = openDatabase(path)

  return {
    addReflection(record: AgentReflectionRecord) {
      db.prepare(`
        INSERT INTO agent_reflections (id, key_id, conversation_id, summary, raw_json, created_at)
        VALUES (@id, @keyId, @conversationId, @summary, @rawJson, @createdAt)
      `).run({ ...record, conversationId: record.conversationId ?? null })
    },

    listReflectionsByKey(keyId: string, limit = 12): AgentReflectionRecord[] {
      return db.prepare(`
        SELECT
          id,
          key_id AS keyId,
          conversation_id AS conversationId,
          summary,
          raw_json AS rawJson,
          created_at AS createdAt
        FROM agent_reflections
        WHERE key_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(keyId, limit) as AgentReflectionRecord[]
    },
  }
}

export function createAgentEvolutionRepository(path: string) {
  const db = openDatabase(path)

  return {
    addProposal(record: AgentEvolutionProposalRecord) {
      db.prepare(`
        INSERT INTO agent_evolution_proposals (
          id,
          key_id,
          reflection_id,
          type,
          title,
          summary,
          payload_json,
          status,
          created_at,
          updated_at
        )
        VALUES (
          @id,
          @keyId,
          @reflectionId,
          @type,
          @title,
          @summary,
          @payloadJson,
          @status,
          @createdAt,
          @updatedAt
        )
      `).run({ ...record, reflectionId: record.reflectionId ?? null })
    },

    listProposalsByKey(keyId: string, status?: AgentEvolutionProposalRecord['status']): AgentEvolutionProposalRecord[] {
      if (status) {
        return db.prepare(`
          SELECT
            id,
            key_id AS keyId,
            reflection_id AS reflectionId,
            type,
            title,
            summary,
            payload_json AS payloadJson,
            status,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM agent_evolution_proposals
          WHERE key_id = ? AND status = ?
          ORDER BY created_at DESC
        `).all(keyId, status) as AgentEvolutionProposalRecord[]
      }

      return db.prepare(`
        SELECT
          id,
          key_id AS keyId,
          reflection_id AS reflectionId,
          type,
          title,
          summary,
          payload_json AS payloadJson,
          status,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM agent_evolution_proposals
        WHERE key_id = ?
        ORDER BY created_at DESC
      `).all(keyId) as AgentEvolutionProposalRecord[]
    },

    updateProposal(id: string, updates: Pick<AgentEvolutionProposalRecord, 'status' | 'updatedAt'>) {
      db.prepare(`
        UPDATE agent_evolution_proposals
        SET status = @status,
            updated_at = @updatedAt
        WHERE id = @id
      `).run({ id, ...updates })
    },
  }
}

export function createAgentSnapshotRepository(path: string) {
  const db = openDatabase(path)

  return {
    addSnapshot(record: AgentStateSnapshotRecord) {
      db.prepare(`
        INSERT INTO agent_state_snapshots (id, key_id, proposal_id, profile_json, created_at)
        VALUES (@id, @keyId, @proposalId, @profileJson, @createdAt)
      `).run({ ...record, proposalId: record.proposalId ?? null })
    },

    listSnapshotsByKey(keyId: string, limit = 12): AgentStateSnapshotRecord[] {
      return db.prepare(`
        SELECT
          id,
          key_id AS keyId,
          proposal_id AS proposalId,
          profile_json AS profileJson,
          created_at AS createdAt
        FROM agent_state_snapshots
        WHERE key_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(keyId, limit) as AgentStateSnapshotRecord[]
    },

    getSnapshotByKey(keyId: string, id: string): AgentStateSnapshotRecord | undefined {
      return db.prepare(`
        SELECT
          id,
          key_id AS keyId,
          proposal_id AS proposalId,
          profile_json AS profileJson,
          created_at AS createdAt
        FROM agent_state_snapshots
        WHERE key_id = ?
          AND id = ?
      `).get(keyId, id) as AgentStateSnapshotRecord | undefined
    },
  }
}

const defaultAgentContentStrategy: Required<AgentContentStrategy> = {
  replyLength: 'balanced',
  structure: 'plain',
  initiative: 'low',
}

const defaultAgentState = {
  tone: '克制、温柔、安静',
  relationshipRole: '记忆星球守护者',
  learningMode: 'assisted',
  contentStrategy: defaultAgentContentStrategy,
} satisfies Omit<AgentStateRecord, 'keyId' | 'updatedAt'>

function parseAgentContentStrategy(value: string): AgentContentStrategy {
  try {
    const parsed = JSON.parse(value) as AgentContentStrategy

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...defaultAgentContentStrategy }
    }

    return {
      replyLength: ['short', 'balanced', 'rich'].includes(String(parsed.replyLength))
        ? parsed.replyLength
        : defaultAgentContentStrategy.replyLength,
      structure: ['plain', 'letter', 'checklist'].includes(String(parsed.structure))
        ? parsed.structure
        : defaultAgentContentStrategy.structure,
      initiative: ['low', 'medium'].includes(String(parsed.initiative))
        ? parsed.initiative
        : defaultAgentContentStrategy.initiative,
    }
  } catch {
    return { ...defaultAgentContentStrategy }
  }
}

function mapAgentStateRow(row: {
  keyId: string
  tone: string
  relationshipRole: string
  learningMode: AgentStateRecord['learningMode']
  contentStrategyJson: string
  lastSleepAt?: string | null
  nextSleepAt?: string | null
  updatedAt: string
}): AgentStateRecord {
  return {
    keyId: row.keyId,
    tone: row.tone,
    relationshipRole: row.relationshipRole,
    learningMode: row.learningMode,
    contentStrategy: parseAgentContentStrategy(row.contentStrategyJson),
    lastSleepAt: row.lastSleepAt,
    nextSleepAt: row.nextSleepAt,
    updatedAt: row.updatedAt,
  }
}

export function createAgentStateRepository(path: string) {
  const db = openDatabase(path)

  return {
    getAgentState(keyId: string): AgentStateRecord | undefined {
      const row = db.prepare(`
        SELECT
          key_id AS keyId,
          tone,
          relationship_role AS relationshipRole,
          learning_mode AS learningMode,
          content_strategy_json AS contentStrategyJson,
          last_sleep_at AS lastSleepAt,
          next_sleep_at AS nextSleepAt,
          updated_at AS updatedAt
        FROM agent_states
        WHERE key_id = ?
      `).get(keyId) as Parameters<typeof mapAgentStateRow>[0] | undefined

      return row ? mapAgentStateRow(row) : undefined
    },

    getOrCreateAgentState(keyId: string, now: string): AgentStateRecord {
      const existing = this.getAgentState(keyId)

      if (existing) {
        return existing
      }

      const record: AgentStateRecord = {
        keyId,
        tone: defaultAgentState.tone,
        relationshipRole: defaultAgentState.relationshipRole,
        learningMode: defaultAgentState.learningMode,
        contentStrategy: { ...defaultAgentState.contentStrategy },
        lastSleepAt: null,
        nextSleepAt: null,
        updatedAt: now,
      }

      db.prepare(`
        INSERT INTO agent_states (
          key_id,
          tone,
          relationship_role,
          learning_mode,
          content_strategy_json,
          last_sleep_at,
          next_sleep_at,
          updated_at
        )
        VALUES (
          @keyId,
          @tone,
          @relationshipRole,
          @learningMode,
          @contentStrategyJson,
          @lastSleepAt,
          @nextSleepAt,
          @updatedAt
        )
      `).run({
        ...record,
        contentStrategyJson: JSON.stringify(record.contentStrategy),
      })

      return record
    },

    updateAgentState(keyId: string, updates: Partial<Omit<AgentStateRecord, 'keyId'>> & { updatedAt: string }) {
      const current = this.getAgentState(keyId)

      if (!current) {
        return
      }

      const next: AgentStateRecord = {
        ...current,
        ...updates,
        contentStrategy: updates.contentStrategy ?? current.contentStrategy,
      }

      db.prepare(`
        UPDATE agent_states
        SET
          tone = @tone,
          relationship_role = @relationshipRole,
          learning_mode = @learningMode,
          content_strategy_json = @contentStrategyJson,
          last_sleep_at = @lastSleepAt,
          next_sleep_at = @nextSleepAt,
          updated_at = @updatedAt
        WHERE key_id = @keyId
      `).run({
        ...next,
        contentStrategyJson: JSON.stringify(next.contentStrategy),
        lastSleepAt: next.lastSleepAt ?? null,
        nextSleepAt: next.nextSleepAt ?? null,
      })
    },
  }
}

export function createAgentSleepRepository(path: string) {
  const db = openDatabase(path)

  function mapRow(row: AgentSleepRunRecord | undefined) {
    return row
  }

  return {
    addSleepRun(record: AgentSleepRunRecord) {
      db.prepare(`
        INSERT INTO agent_sleep_runs (
          id,
          key_id,
          status,
          summary,
          raw_json,
          memory_actions_json,
          work_ideas_json,
          next_conversation_hints_json,
          started_at,
          completed_at,
          error
        )
        VALUES (
          @id,
          @keyId,
          @status,
          @summary,
          @rawJson,
          @memoryActionsJson,
          @workIdeasJson,
          @nextConversationHintsJson,
          @startedAt,
          @completedAt,
          @error
        )
      `).run({
        ...record,
        memoryActionsJson: record.memoryActionsJson ?? null,
        workIdeasJson: record.workIdeasJson ?? null,
        nextConversationHintsJson: record.nextConversationHintsJson ?? null,
        completedAt: record.completedAt ?? null,
        error: record.error ?? null,
      })
    },

    updateSleepRun(id: string, updates: Partial<Pick<AgentSleepRunRecord, 'status' | 'summary' | 'rawJson' | 'memoryActionsJson' | 'workIdeasJson' | 'nextConversationHintsJson' | 'completedAt' | 'error'>>) {
      const current = this.getSleepRun(id)

      if (!current) {
        return
      }

      db.prepare(`
        UPDATE agent_sleep_runs
        SET
          status = @status,
          summary = @summary,
          raw_json = @rawJson,
          memory_actions_json = @memoryActionsJson,
          work_ideas_json = @workIdeasJson,
          next_conversation_hints_json = @nextConversationHintsJson,
          completed_at = @completedAt,
          error = @error
        WHERE id = @id
      `).run({
        id,
        status: updates.status ?? current.status,
        summary: updates.summary ?? current.summary,
        rawJson: updates.rawJson ?? current.rawJson,
        memoryActionsJson: updates.memoryActionsJson ?? current.memoryActionsJson ?? null,
        workIdeasJson: updates.workIdeasJson ?? current.workIdeasJson ?? null,
        nextConversationHintsJson: updates.nextConversationHintsJson ?? current.nextConversationHintsJson ?? null,
        completedAt: updates.completedAt ?? current.completedAt ?? null,
        error: updates.error ?? current.error ?? null,
      })
    },

    getSleepRun(id: string): AgentSleepRunRecord | undefined {
      return mapRow(db.prepare(`
        SELECT
          id,
          key_id AS keyId,
          status,
          summary,
          raw_json AS rawJson,
          memory_actions_json AS memoryActionsJson,
          work_ideas_json AS workIdeasJson,
          next_conversation_hints_json AS nextConversationHintsJson,
          started_at AS startedAt,
          completed_at AS completedAt,
          error
        FROM agent_sleep_runs
        WHERE id = ?
      `).get(id) as AgentSleepRunRecord | undefined)
    },

    listSleepRunsByKey(keyId: string, limit = 5): AgentSleepRunRecord[] {
      return db.prepare(`
        SELECT
          id,
          key_id AS keyId,
          status,
          summary,
          raw_json AS rawJson,
          memory_actions_json AS memoryActionsJson,
          work_ideas_json AS workIdeasJson,
          next_conversation_hints_json AS nextConversationHintsJson,
          started_at AS startedAt,
          completed_at AS completedAt,
          error
        FROM agent_sleep_runs
        WHERE key_id = ?
        ORDER BY started_at DESC
        LIMIT ?
      `).all(keyId, limit) as AgentSleepRunRecord[]
    },

    getLatestSleepRunByKey(keyId: string): AgentSleepRunRecord | undefined {
      return this.listSleepRunsByKey(keyId, 1)[0]
    },
  }
}

export function createAgentWorkRepository(path: string) {
  const db = openDatabase(path)

  const selectColumns = `
    id,
    key_id AS keyId,
    type,
    title,
    summary,
    source_conversation_id AS sourceConversationId,
    source_media_task_id AS sourceMediaTaskId,
    source_design_version AS sourceDesignVersion,
    preview_url AS previewUrl,
    payload_json AS payloadJson,
    visibility,
    created_at AS createdAt,
    updated_at AS updatedAt
  `

  return {
    addWork(record: AgentWorkRecord) {
      db.prepare(`
        INSERT INTO agent_works (
          id,
          key_id,
          type,
          title,
          summary,
          source_conversation_id,
          source_media_task_id,
          source_design_version,
          preview_url,
          payload_json,
          visibility,
          created_at,
          updated_at
        )
        VALUES (
          @id,
          @keyId,
          @type,
          @title,
          @summary,
          @sourceConversationId,
          @sourceMediaTaskId,
          @sourceDesignVersion,
          @previewUrl,
          @payloadJson,
          @visibility,
          @createdAt,
          @updatedAt
        )
      `).run({
        ...record,
        sourceConversationId: record.sourceConversationId ?? null,
        sourceMediaTaskId: record.sourceMediaTaskId ?? null,
        sourceDesignVersion: record.sourceDesignVersion ?? null,
        previewUrl: record.previewUrl ?? null,
      })
    },

    listWorksByKey(keyId: string): AgentWorkRecord[] {
      return db.prepare(`
        SELECT ${selectColumns}
        FROM agent_works
        WHERE key_id = ?
        ORDER BY created_at DESC
      `).all(keyId) as AgentWorkRecord[]
    },

    getWorkByKey(keyId: string, id: string): AgentWorkRecord | undefined {
      return db.prepare(`
        SELECT ${selectColumns}
        FROM agent_works
        WHERE key_id = ? AND id = ?
      `).get(keyId, id) as AgentWorkRecord | undefined
    },

    updateWorkVisibility(keyId: string, id: string, visibility: AgentWorkVisibility, updatedAt: string) {
      db.prepare(`
        UPDATE agent_works
        SET visibility = @visibility,
            updated_at = @updatedAt
        WHERE key_id = @keyId AND id = @id
      `).run({ keyId, id, visibility, updatedAt })
    },

    listPublicWorks(limit = 80): AgentWorkRecord[] {
      return db.prepare(`
        SELECT ${selectColumns}
        FROM agent_works
        WHERE visibility = 'public'
        ORDER BY updated_at DESC
        LIMIT ?
      `).all(limit) as AgentWorkRecord[]
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
