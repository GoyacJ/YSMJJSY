export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    key_id TEXT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    message_json TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    key_id TEXT,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    importance REAL NOT NULL,
    confidence REAL NOT NULL DEFAULT 1,
    source_conversation_id TEXT,
    source_attachment_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    updated_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS memory_events (
    id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,
    memory_id TEXT NOT NULL,
    action TEXT NOT NULL,
    before_json TEXT NOT NULL,
    after_json TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS agent_reflections (
    id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,
    conversation_id TEXT,
    summary TEXT NOT NULL,
    raw_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS agent_evolution_proposals (
    id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,
    reflection_id TEXT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS agent_state_snapshots (
    id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,
    proposal_id TEXT,
    profile_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS agent_states (
    key_id TEXT PRIMARY KEY,
    tone TEXT NOT NULL,
    relationship_role TEXT NOT NULL,
    learning_mode TEXT NOT NULL,
    content_strategy_json TEXT NOT NULL,
    last_sleep_at TEXT,
    next_sleep_at TEXT,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS agent_sleep_runs (
    id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,
    status TEXT NOT NULL,
    summary TEXT NOT NULL,
    raw_json TEXT NOT NULL,
    memory_actions_json TEXT,
    work_ideas_json TEXT,
    next_conversation_hints_json TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    error TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS agent_works (
    id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    source_conversation_id TEXT,
    source_media_task_id TEXT,
    source_design_version INTEGER,
    preview_url TEXT,
    payload_json TEXT NOT NULL,
    visibility TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS media_tasks (
    id TEXT PRIMARY KEY,
    key_id TEXT,
    type TEXT NOT NULL,
    provider_task_id TEXT,
    status TEXT NOT NULL,
    prompt TEXT NOT NULL,
    result_url TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS key_profiles (
    id TEXT PRIMARY KEY,
    key_lookup_hash TEXT NOT NULL UNIQUE,
    assistant_name TEXT NOT NULL DEFAULT '',
    mbti TEXT NOT NULL DEFAULT '',
    configured_at TEXT,
    created_ip_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    activity_at TEXT,
    activity_kind TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS key_designs (
    key_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    schema_json TEXT NOT NULL,
    prompt TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (key_id, version),
    FOREIGN KEY (key_id) REFERENCES key_profiles(id)
  )`,
  `CREATE TABLE IF NOT EXISTS key_usage_limits (
    key_id TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    date TEXT NOT NULL,
    create_count INTEGER NOT NULL DEFAULT 0,
    chat_count INTEGER NOT NULL DEFAULT 0,
    design_count INTEGER NOT NULL DEFAULT 0,
    upload_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (key_id, ip_hash, date)
  )`,
  `CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,
    conversation_id TEXT,
    type TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    filename TEXT NOT NULL,
    data_url TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (key_id) REFERENCES key_profiles(id)
  )`,
]
