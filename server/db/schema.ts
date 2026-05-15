export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    importance REAL NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS media_tasks (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    provider_task_id TEXT,
    status TEXT NOT NULL,
    prompt TEXT NOT NULL,
    result_url TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
]
