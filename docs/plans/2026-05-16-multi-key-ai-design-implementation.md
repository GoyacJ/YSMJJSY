# Multi-Key AI Starletter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add public key creation, per-key profile/configuration, isolated chat/memory/design state, a bottom multimodal composer, and a safe schema-driven AI page design mode.

**Architecture:** Keep Nuxt as the full-stack app. Add server-side key profiles with hashed lookup, key-scoped sessions, SQLite-backed rate limits, per-key conversations/memories/media/designs, and a safe design schema renderer. MiniMax remains server-only; AI design responses must be validated JSON schema patches, never executable HTML/JS.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Nitro server routes, SQLite with `better-sqlite3`, Zod, MiniMax API, Web Speech API, Pretext, Vitest, Playwright.

---

## Non-Negotiable Constraints

- Any visitor can create a key.
- The database must not store plaintext keys.
- Key creation and AI usage must be rate-limited before calling MiniMax.
- Each key must isolate profile, design, conversations, memories, usage counters, and attachments.
- AI design mode must be schema-driven. Do not execute AI-returned HTML, CSS, or JavaScript.
- Audio/video upload support does not imply model understanding unless the provider endpoint is explicitly verified. First implementation may attach and display audio/video while only images are semantically described.
- Do not commit `.env` or print MiniMax keys in logs, tests, snapshots, or docs.

## Execution Rules

- Execute tasks in order with `superpowers:executing-plans`.
- After each task passes its listed verification, append that task's checkpoint to `docs/plans/2026-05-15-520-nuxt-minimax-implementation.md`.
- Commit after each completed task unless the working tree contains unrelated user changes.
- Suggested commit messages:
  - Task 1: `feat: add multi-key persistence schema`
  - Task 2: `feat: add key hashing and usage limits`
  - Task 3: `feat: add public key creation sessions`
  - Task 4: `feat: add key profile setup`
  - Task 5: `feat: scope ai state by key`
  - Task 6: `feat: add create key unlock gate`
  - Task 7: `feat: add safe dynamic page renderer`
  - Task 8: `feat: add ai design preview api`
  - Task 9: `feat: add bottom multimodal composer`
  - Task 10: `feat: persist chat attachments`
  - Task 11: `feat: add design mode preview flow`
  - Task 12: `feat: add profile settings sheet`
  - Task 13: `test: cover multi-key design flow`

## MiniMax References

- API overview: https://platform.minimaxi.com/docs/api-reference/api-overview
- Model overview: https://platform.minimaxi.com/
- Image generation: https://platform.minimaxi.com/docs/guides/image-generation
- Video generation: https://platform.minimaxi.com/docs/guides/video-generation
- File management overview is listed in the API overview. It supports upload/list/retrieve/download/delete and includes audio formats such as `mp3`, `m4a`, `wav`.

---

### Task 1: Add Key And Rate-Limit Schema

**Files:**
- Modify: `server/db/schema.ts`
- Modify: `server/db/sqlite.ts`
- Modify: `server/db/sqlite.test.ts`

**Step 1: Write failing schema/repository tests**

Add tests for:

```ts
it('creates and finds a key profile by lookup hash', () => {
  const repo = createKeyProfileRepository(':memory:')
  repo.addKeyProfile({
    id: 'key_1',
    keyLookupHash: 'lookup',
    assistantName: '',
    mbti: '',
    configuredAt: null,
    createdIpHash: 'ip_hash',
    createdAt: '2026-05-16T00:00:00.000Z',
    updatedAt: '2026-05-16T00:00:00.000Z',
  })

  expect(repo.findByLookupHash('lookup')?.id).toBe('key_1')
})

it('stores usage limits by key and date', () => {
  const repo = createUsageLimitRepository(':memory:')
  repo.incrementUsage({
    keyId: 'key_1',
    ipHash: 'ip_hash',
    date: '2026-05-16',
    bucket: 'chat',
  })

  expect(repo.getUsage('key_1', '2026-05-16')?.chatCount).toBe(1)
})
```

**Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected: FAIL because repositories and tables do not exist.

**Step 3: Add tables**

Add these schema statements:

```sql
CREATE TABLE IF NOT EXISTS key_profiles (
  id TEXT PRIMARY KEY,
  key_lookup_hash TEXT NOT NULL UNIQUE,
  assistant_name TEXT NOT NULL DEFAULT '',
  mbti TEXT NOT NULL DEFAULT '',
  configured_at TEXT,
  created_ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

```sql
CREATE TABLE IF NOT EXISTS key_designs (
  key_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  schema_json TEXT NOT NULL,
  prompt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (key_id, version),
  FOREIGN KEY (key_id) REFERENCES key_profiles(id)
)
```

```sql
CREATE TABLE IF NOT EXISTS key_usage_limits (
  key_id TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  date TEXT NOT NULL,
  create_count INTEGER NOT NULL DEFAULT 0,
  chat_count INTEGER NOT NULL DEFAULT 0,
  design_count INTEGER NOT NULL DEFAULT 0,
  upload_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key_id, ip_hash, date)
)
```

```sql
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL,
  conversation_id TEXT,
  type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  filename TEXT NOT NULL,
  data_url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (key_id) REFERENCES key_profiles(id)
)
```

Add `key_id TEXT` to `conversations`, `memories`, and `media_tasks`.

**Step 4: Add lightweight migrations**

In `server/db/sqlite.ts`, after table creation, add a safe helper:

```ts
function ensureColumn(db: Database.Database, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!columns.some(item => item.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run()
  }
}
```

Use it for existing tables:

```ts
ensureColumn(db, 'conversations', 'key_id', 'TEXT')
ensureColumn(db, 'memories', 'key_id', 'TEXT')
ensureColumn(db, 'media_tasks', 'key_id', 'TEXT')
```

**Step 5: Add repositories**

Add:

- `createKeyProfileRepository`
- `createKeyDesignRepository`
- `createUsageLimitRepository`
- `createAttachmentRepository`

Keep existing repositories backward-compatible, but add key-scoped methods:

```ts
listRecentConversationsByKey(keyId: string, limit = 12)
listMemoriesByKey(keyId: string)
```

**Step 6: Run tests**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected: PASS.

**Checkpoint**

Append to `docs/plans/2026-05-15-520-nuxt-minimax-implementation.md`:

```markdown
### Checkpoint: Multi-Key Schema

- Added key profiles, key designs, usage limits, attachments, and key-scoped data columns.
- Added repository tests for key lookup and usage counters.
- Verification: `npm run test -- server/db/sqlite.test.ts`
```

---

### Task 2: Add Key Hashing And Rate Limit Services

**Files:**
- Create: `server/services/key-access.ts`
- Create: `server/services/key-access.test.ts`
- Create: `server/services/rate-limit.ts`
- Create: `server/services/rate-limit.test.ts`

**Step 1: Write failing tests**

Test key normalization and lookup hash:

```ts
expect(normalizeKey('  abc  ')).toBe('abc')
expect(() => normalizeKey('')).toThrow()
expect(createKeyLookupHash('abc', 'secret')).toBe(createKeyLookupHash('abc', 'secret'))
expect(createKeyLookupHash('abc', 'secret')).not.toBe('abc')
```

Test IP hash:

```ts
expect(createIpHash('127.0.0.1', 'secret')).toBe(createIpHash('127.0.0.1', 'secret'))
expect(createIpHash('127.0.0.1', 'secret')).not.toContain('127.0.0.1')
```

Test limits:

```ts
expect(assertWithinLimit({ current: 0, max: 5 })).toBe(true)
expect(assertWithinLimit({ current: 5, max: 5 })).toBe(false)
```

**Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- server/services/key-access.test.ts server/services/rate-limit.test.ts
```

Expected: FAIL because files do not exist.

**Step 3: Implement `key-access.ts`**

Use Node crypto HMAC:

```ts
import { createHmac } from 'node:crypto'

export function normalizeKey(input: string) {
  const normalized = input.trim()
  if (normalized.length < 3 || normalized.length > 64) {
    throw new Error('Invalid key length')
  }
  if (/[\x00-\x1F\x7F]/.test(normalized)) {
    throw new Error('Invalid key characters')
  }
  return normalized
}

export function createKeyLookupHash(key: string, secret: string) {
  return createHmac('sha256', secret || 'dev-secret').update(normalizeKey(key)).digest('hex')
}

export function createIpHash(ip: string, secret: string) {
  return createHmac('sha256', secret || 'dev-secret').update(ip || 'unknown').digest('hex')
}
```

**Step 4: Implement `rate-limit.ts`**

Export limits:

```ts
export const usageLimits = {
  createPerIpPerDay: 5,
  createPerIpPerMinute: 1,
  chatPerKeyPerDay: 80,
  designPerKeyPerDay: 20,
  uploadPerKeyPerDay: 40,
}
```

Add pure helpers for limit checks.

**Step 5: Run tests**

Run:

```bash
npm run test -- server/services/key-access.test.ts server/services/rate-limit.test.ts
```

Expected: PASS.

**Checkpoint**

Append checkpoint:

```markdown
### Checkpoint: Key Hashing And Rate Limits

- Added key normalization, lookup hashing, IP hashing, and pure rate-limit helpers.
- Verification: `npm run test -- server/services/key-access.test.ts server/services/rate-limit.test.ts`
```

---

### Task 3: Replace Single Unlock With Public Key Creation And Key Session

**Files:**
- Modify: `server/services/session.ts`
- Modify: `server/services/session.test.ts`
- Modify: `server/api/unlock.post.ts`
- Create: `server/api/keys.post.ts`
- Create: `server/api/keys.post.test.ts`
- Modify: `server/middleware/session.ts`
- Modify: `composables/useUnlock.ts`

**Step 1: Write failing tests**

Add session tests:

```ts
const token = createKeySessionToken('key_1', 'secret')
expect(readKeySessionToken(token, 'secret')?.keyId).toBe('key_1')
expect(readKeySessionToken(`${token}x`, 'secret')).toBeUndefined()
```

Add API tests for:

- `POST /api/keys` creates a new key profile.
- duplicate key returns conflict.
- `POST /api/unlock` succeeds for created key.
- legacy `100522` may still work by auto-creating a default profile if desired.

**Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- server/services/session.test.ts server/api/keys.post.test.ts
```

Expected: FAIL.

**Step 3: Update session service**

Implement signed key session:

```ts
export function createKeySessionToken(keyId: string, sessionSecret: string) {
  const signature = createHmac('sha256', sessionSecret || 'dev-secret').update(keyId).digest('hex')
  return `${keyId}.${signature}`
}

export function readKeySessionToken(token: string | undefined, sessionSecret: string) {
  if (!token) return undefined
  const [keyId, signature] = token.split('.')
  if (!keyId || !signature) return undefined
  return token === createKeySessionToken(keyId, sessionSecret) ? { keyId } : undefined
}
```

**Step 4: Add `POST /api/keys`**

Input:

```ts
{
  key: string
}
```

Behavior:

- normalize key
- hash key for lookup
- hash client IP
- enforce IP create limits
- reject duplicates with `409`
- create key profile
- insert default design schema version `1`
- set session cookie for the new key
- return `{ ok: true, keyId, needsConfig: true }`

**Step 5: Update `POST /api/unlock`**

Behavior:

- normalize key
- hash lookup
- find profile
- if not found, return `{ ok: false }`
- set key session cookie
- return `{ ok: true, keyId, needsConfig: !configuredAt }`

**Step 6: Update middleware**

Keep `/api/unlock` and `/api/keys` public.
Other `/api/*` routes require a valid key session.
Attach `event.context.keyId`.

**Step 7: Update `useUnlock.ts`**

Expose:

```ts
unlock(key: string)
createKey(key: string)
```

Both return:

```ts
type KeyAccessResult = {
  ok: boolean
  keyId?: string
  needsConfig?: boolean
  message?: string
}
```

**Step 8: Run tests**

Run:

```bash
npm run test -- server/services/session.test.ts server/api/keys.post.test.ts server/services/key-access.test.ts
```

Expected: PASS.

**Checkpoint**

Append checkpoint:

```markdown
### Checkpoint: Public Key Creation And Sessions

- Added public key creation, hashed key lookup, duplicate detection, and signed key sessions.
- Replaced global unlock session with key-scoped session context.
- Verification: `npm run test -- server/services/session.test.ts server/api/keys.post.test.ts server/services/key-access.test.ts`
```

---

### Task 4: Add First-Time Profile Configuration

**Files:**
- Create: `server/api/key/profile.get.ts`
- Create: `server/api/key/profile.put.ts`
- Create: `server/api/key/profile.test.ts`
- Create: `components/KeySetupPanel.vue`
- Create: `components/KeySetupPanel.test.ts`
- Modify: `pages/index.vue`
- Modify: `assets/css/main.css`

**Step 1: Write API tests**

Test:

- profile returns key profile for current session
- profile update validates MBTI and assistant name
- update sets `configured_at`

Example body:

```ts
{
  assistantName: '星信',
  mbti: 'INTJ'
}
```

Allowed MBTI values:

```ts
['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP']
```

**Step 2: Write component tests**

Test that saving emits `configured` after successful submit.

**Step 3: Run tests to verify failure**

Run:

```bash
npm run test -- server/api/key/profile.test.ts components/KeySetupPanel.test.ts
```

Expected: FAIL.

**Step 4: Implement API**

Use `event.context.keyId`.

`GET /api/key/profile` returns:

```ts
{
  keyId: string,
  assistantName: string,
  mbti: string,
  configured: boolean
}
```

`PUT /api/key/profile` updates profile.

**Step 5: Implement `KeySetupPanel.vue`**

UI:

- assistant name input
- MBTI select
- save button

No large marketing copy.
Keep it as a quiet first-time setup sheet.

**Step 6: Wire `pages/index.vue`**

Add phase:

```ts
'locked' | 'configuring' | 'experience'
```

After unlock/create:

- if `needsConfig`, show `KeySetupPanel`
- otherwise show key experience

**Step 7: Run tests**

Run:

```bash
npm run test -- server/api/key/profile.test.ts components/KeySetupPanel.test.ts
```

Expected: PASS.

**Checkpoint**

Append checkpoint:

```markdown
### Checkpoint: Key Profile Setup

- Added first-time assistant name and MBTI configuration.
- Added key profile API and setup panel.
- Verification: `npm run test -- server/api/key/profile.test.ts components/KeySetupPanel.test.ts`
```

---

### Task 5: Key-Scope Chat, Memory, Media, And Persona

**Files:**
- Modify: `server/api/chat.post.ts`
- Modify: `server/api/chat.post.test.ts`
- Modify: `server/services/memory.test.ts`
- Modify: `server/api/media.test.ts`
- Modify: `server/api/tts.post.ts`
- Modify: `server/api/image.post.ts`
- Modify: `server/api/music.post.ts`
- Modify: `server/api/video/tasks.post.ts`
- Modify: `server/api/video/tasks/[id].get.ts`
- Modify: `server/services/media.ts`
- Modify: `components/StarChat.test.ts`

**Step 1: Write failing chat tests**

Add tests that:

- `buildStarChatMessages` includes assistant name and MBTI.
- recent conversations are loaded only for the current key.
- memories are loaded only for the current key.

Expected system prompt fragments:

```text
你的称呼是：星信
MBTI 性格设定：INTJ
```

**Step 2: Update repositories in tests**

Add repository tests for `listRecentConversationsByKey` and `listMemoriesByKey`.

**Step 3: Run tests to verify failure**

Run:

```bash
npm run test -- server/api/chat.post.test.ts server/db/sqlite.test.ts
```

Expected: FAIL.

**Step 4: Update chat API**

Use:

```ts
const keyId = event.context.keyId
```

Load profile:

```ts
const profile = keyProfiles.getKeyProfile(keyId)
```

Load key-scoped data:

```ts
conversations.listRecentConversationsByKey(keyId, 12)
memories.listMemoriesByKey(keyId)
```

Save conversations and memories with `keyId`.

**Step 5: Add chat usage limit**

Before MiniMax call:

- read current key/day usage
- reject with `429` if over `chatPerKeyPerDay`
- increment only after validation, before provider call

**Step 6: Key-scope media endpoints**

All generated media tasks must save `keyId`.
Video task lookup must ensure the task belongs to the current `keyId`.

**Step 7: Run tests**

Run:

```bash
npm run test -- server/api/chat.post.test.ts server/db/sqlite.test.ts server/api/media.test.ts
```

Expected: PASS.

**Checkpoint**

Append checkpoint:

```markdown
### Checkpoint: Key-Scoped AI State

- Scoped chat, memory, media tasks, and persona to the active key.
- Added chat usage limit before MiniMax calls.
- Verification: `npm run test -- server/api/chat.post.test.ts server/db/sqlite.test.ts server/api/media.test.ts`
```

---

### Task 6: Redesign Unlock Gate For Create Or Enter

**Files:**
- Modify: `components/UnlockGate.vue`
- Modify: `components/UnlockGate.test.ts`
- Modify: `pages/index.vue`
- Modify: `assets/css/main.css`

**Step 1: Write failing tests**

Add tests:

```ts
it('creates a key and emits created', async () => {
  const createKey = vi.fn(async () => ({ ok: true, keyId: 'key_1', needsConfig: true }))
  const wrapper = mount(UnlockGate, {
    props: {
      unlock: async () => ({ ok: false }),
      createKey,
    },
  })

  await wrapper.get('button[aria-label="创建钥匙"]').trigger('click')
  await wrapper.find('input').setValue('my-key')
  await wrapper.get('button[aria-label="保存钥匙"]').trigger('click')

  expect(createKey).toHaveBeenCalledWith('my-key')
  expect(wrapper.emitted('created')).toBeTruthy()
})
```

**Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- components/UnlockGate.test.ts
```

Expected: FAIL.

**Step 3: Update props/emits**

Props:

```ts
unlock: (key: string) => Promise<KeyAccessResult>
createKey: (key: string) => Promise<KeyAccessResult>
```

Emits:

```ts
unlocked: [result: KeyAccessResult]
created: [result: KeyAccessResult]
```

**Step 4: Update UI**

Keep envelope visual.
Add two modes:

- enter mode: input key + open letter
- create mode: input key + save key

Use one secondary button:

```text
创建钥匙
```

In create mode:

```text
保存钥匙
返回输入
```

**Step 5: Wire page**

In `pages/index.vue`, pass `createKey`.
After `created` or `unlocked`, route to `configuring` or `experience` based on `needsConfig`.

**Step 6: Run tests**

Run:

```bash
npm run test -- components/UnlockGate.test.ts
```

Expected: PASS.

**Checkpoint**

Append checkpoint:

```markdown
### Checkpoint: Create-Or-Enter Gate

- Added public key creation mode to the unlock gate.
- Wired created/unlocked results into the first-time setup flow.
- Verification: `npm run test -- components/UnlockGate.test.ts`
```

---

### Task 7: Add Dynamic Design Schema And Renderer

**Files:**
- Create: `types/design-schema.ts`
- Create: `server/services/design-schema.ts`
- Create: `server/services/design-schema.test.ts`
- Create: `components/DynamicStarPage.vue`
- Create: `components/DynamicStarPage.test.ts`
- Modify: `pages/index.vue`
- Modify: `assets/css/main.css`

**Step 1: Write schema tests**

Define supported schema:

```ts
export type StarPageDesignSchema = {
  version: 1
  theme: 'star-letter' | 'moon-note' | 'film-memory'
  palette: 'rose-gold' | 'midnight' | 'paper-moon'
  title: string
  subtitle: string
  sections: Array<
    | { type: 'letter'; text: string; layout?: 'normal' | 'moon-wrap' | 'date-orbit' | 'star-trail' }
    | { type: 'memory-map'; items: Array<{ date: string; text: string }> }
    | { type: 'star-scene'; density: number; caption: string }
  >
}
```

Test:

- default schema validates
- invalid section type fails
- title length over limit fails

**Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- server/services/design-schema.test.ts components/DynamicStarPage.test.ts
```

Expected: FAIL.

**Step 3: Implement Zod schema**

Add:

```ts
export const starPageDesignSchema = z.object(...)
export function createDefaultDesignSchema(...)
export function parseDesignSchema(input: unknown)
```

Limit text lengths:

- title max 80
- subtitle max 160
- letter text max 600
- max sections 8
- max memory items 8

**Step 4: Implement renderer**

`DynamicStarPage.vue` renders only known section types.
Use existing `PretextParagraph` for letter sections.
Use star-coordinate layout for memory map.
Use existing `StarScene` only for final star section or create a lighter inline star section.

**Step 5: Wire page**

After configuration, load current key design schema and render `DynamicStarPage`.
Keep `StarChat` bottom composer visible.

**Step 6: Run tests**

Run:

```bash
npm run test -- server/services/design-schema.test.ts components/DynamicStarPage.test.ts
```

Expected: PASS.

**Checkpoint**

Append checkpoint:

```markdown
### Checkpoint: Schema-Driven Page Renderer

- Added safe design schema validation and dynamic page rendering.
- Replaced hard-coded page display with key-specific schema rendering.
- Verification: `npm run test -- server/services/design-schema.test.ts components/DynamicStarPage.test.ts`
```

---

### Task 8: Add Design Load, Preview, And Save APIs

**Files:**
- Create: `server/api/design.get.ts`
- Create: `server/api/design/preview.post.ts`
- Create: `server/api/design/commit.post.ts`
- Create: `server/api/design.test.ts`
- Modify: `server/services/minimax.ts`
- Modify: `server/services/minimax.test.ts`

**Step 1: Write failing tests**

Test:

- `GET /api/design` returns latest schema for current key.
- `POST /api/design/preview` rejects invalid AI JSON.
- preview does not write to database.
- commit writes a new version.

**Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- server/api/design.test.ts server/services/minimax.test.ts
```

Expected: FAIL.

**Step 3: Add MiniMax design method**

Add:

```ts
generateDesignPatch(input: {
  currentSchema: StarPageDesignSchema
  instruction: string
  assistantName: string
  mbti: string
}): Promise<unknown>
```

Prompt requirements:

- return JSON only
- do not return code
- modify only allowed schema fields
- preserve emotional tone

**Step 4: Implement preview endpoint**

Behavior:

- enforce `designPerKeyPerDay`
- load current schema
- ask MiniMax for patch/schema
- validate final schema with Zod
- return `{ schema }`
- do not persist

**Step 5: Implement commit endpoint**

Input:

```ts
{
  schema: StarPageDesignSchema,
  prompt: string
}
```

Behavior:

- validate schema
- save as latest version + 1
- return `{ ok: true, version }`

**Step 6: Run tests**

Run:

```bash
npm run test -- server/api/design.test.ts server/services/minimax.test.ts
```

Expected: PASS.

**Checkpoint**

Append checkpoint:

```markdown
### Checkpoint: AI Design Preview And Commit

- Added design load, preview, and commit APIs.
- Added MiniMax JSON-only design schema generation.
- Verified preview does not persist until explicit commit.
- Verification: `npm run test -- server/api/design.test.ts server/services/minimax.test.ts`
```

---

### Task 9: Rebuild Star Chat As Bottom Multimodal Composer

**Files:**
- Modify: `components/StarChat.vue`
- Modify: `components/StarChat.test.ts`
- Modify: `composables/useStarChat.ts`
- Modify: `assets/css/main.css`

**Step 1: Write failing tests**

Add tests for:

- bottom composer exists
- `+` opens attachment input
- image/video/audio file validation
- design mode changes placeholder to `请输入你的创意想法`
- design mode submit calls design handler, not chat handler
- conversation thread becomes more opaque on hover/focus class state

**Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- components/StarChat.test.ts
```

Expected: FAIL.

**Step 3: Update composable types**

Add:

```ts
type ComposerMode = 'chat' | 'design'
type AttachmentKind = 'image' | 'video' | 'audio'
```

`sendMessage` accepts:

```ts
{
  message: string
  attachments: Array<{ kind: AttachmentKind; dataUrl: string; name: string; mimeType: string }>
}
```

**Step 4: Update UI**

Bottom layout:

```text
conversation thread
composer bar:
  + attachment
  voice
  design toggle
  input
  send
```

Use `aria-label`s:

- `添加附件`
- `语音输入`
- `设计模式`
- `发送`

**Step 5: Attachment validation**

Client limits:

- image: `png/jpeg/webp`, max 2MB
- audio: `mp3/m4a/wav/webm`, max 8MB
- video: `mp4/webm/quicktime`, max 20MB

First implementation sends image to vision description.
Audio/video are stored/displayed and included as attachment metadata in chat context.

**Step 6: Conversation opacity behavior**

CSS:

```css
.star-chat__thread {
  opacity: 0.42;
  transition: opacity 180ms ease;
}

.star-chat:hover .star-chat__thread,
.star-chat:focus-within .star-chat__thread,
.star-chat[data-thread-active="true"] .star-chat__thread {
  opacity: 1;
}
```

Use touch/click to set `threadActive`.

**Step 7: Run tests**

Run:

```bash
npm run test -- components/StarChat.test.ts
```

Expected: PASS.

**Checkpoint**

Append checkpoint:

```markdown
### Checkpoint: Bottom Multimodal Composer

- Rebuilt StarChat as a bottom composer with attachment, voice, design, and send controls.
- Added design mode placeholder and mode-specific submit behavior.
- Verification: `npm run test -- components/StarChat.test.ts`
```

---

### Task 10: Add Attachment Persistence And Chat Request Support

**Files:**
- Modify: `server/api/chat.post.ts`
- Modify: `server/api/chat.post.test.ts`
- Modify: `composables/useStarChat.ts`
- Modify: `server/db/sqlite.test.ts`

**Step 1: Write failing tests**

Test:

- image attachment is described by MiniMax vision before chat.
- audio/video attachment metadata is included in user content.
- attachments are saved with `key_id`.
- upload usage limit rejects over-limit requests.

**Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- server/api/chat.post.test.ts server/db/sqlite.test.ts
```

Expected: FAIL.

**Step 3: Update chat schema**

Request body:

```ts
{
  message: string,
  attachments?: Array<{
    kind: 'image' | 'video' | 'audio',
    dataUrl: string,
    name: string,
    mimeType: string
  }>
}
```

Keep backward compatibility with `imageDataUrl`.

**Step 4: Validate server-side**

Use Zod refinements for:

- allowed MIME types
- base64 data URL prefix
- max length
- max attachment count 3

**Step 5: Save attachments**

After creating user conversation, save attachments with:

```ts
keyId
conversationId
type
mimeType
filename
dataUrl
createdAt
```

**Step 6: Build model context**

For images:

- call `client.describeImage`
- include description in prompt

For audio/video:

- include:

```text
用户附带了一个音频/视频文件：filename，类型 mimeType。当前版本不直接解析该文件内容。
```

**Step 7: Run tests**

Run:

```bash
npm run test -- server/api/chat.post.test.ts server/db/sqlite.test.ts
```

Expected: PASS.

**Checkpoint**

Append checkpoint:

```markdown
### Checkpoint: Attachment Persistence And Chat Context

- Added key-scoped attachment persistence.
- Extended chat requests for image, audio, and video attachments.
- Preserved image understanding and added safe metadata context for audio/video.
- Verification: `npm run test -- server/api/chat.post.test.ts server/db/sqlite.test.ts`
```

---

### Task 11: Add Design Mode Client Flow

**Files:**
- Create: `composables/useKeyDesign.ts`
- Create: `components/DesignPreviewSheet.vue`
- Create: `components/DesignPreviewSheet.test.ts`
- Modify: `components/StarChat.vue`
- Modify: `pages/index.vue`
- Modify: `assets/css/main.css`

**Step 1: Write failing tests**

Test:

- design submit calls preview API
- preview sheet renders preview actions
- confirm saves design
- cancel keeps current schema

**Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- components/DesignPreviewSheet.test.ts components/StarChat.test.ts
```

Expected: FAIL.

**Step 3: Implement composable**

Expose:

```ts
const currentSchema = ref<StarPageDesignSchema | null>(null)
const previewSchema = ref<StarPageDesignSchema | null>(null)

loadDesign()
previewDesign(instruction: string)
commitDesign(prompt: string)
discardPreview()
```

**Step 4: Implement preview sheet**

Actions:

- 保存这个设计
- 放弃

The preview should render `DynamicStarPage` inside a constrained preview area.

**Step 5: Wire `StarChat` design mode**

When mode is `design`, submit emits:

```ts
designRequested: [instruction: string]
```

`pages/index.vue` handles preview and commit.

**Step 6: Run tests**

Run:

```bash
npm run test -- components/DesignPreviewSheet.test.ts components/StarChat.test.ts
```

Expected: PASS.

**Checkpoint**

Append checkpoint:

```markdown
### Checkpoint: Design Mode Client Flow

- Added design preview, save, and discard flow.
- Wired design mode composer to schema preview and commit APIs.
- Verification: `npm run test -- components/DesignPreviewSheet.test.ts components/StarChat.test.ts`
```

---

### Task 12: Add Settings Entry At Bottom

**Files:**
- Create: `components/ProfileSettingsSheet.vue`
- Create: `components/ProfileSettingsSheet.test.ts`
- Modify: `pages/index.vue`
- Modify: `assets/css/main.css`

**Step 1: Write failing tests**

Test:

- settings button is available after entering.
- opening settings shows assistant name and MBTI fields.
- saving calls profile update API.

**Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- components/ProfileSettingsSheet.test.ts
```

Expected: FAIL.

**Step 3: Implement component**

Use the same form fields as first-time setup.
Place settings trigger near bottom composer.
Do not add a large settings page.

**Step 4: Run tests**

Run:

```bash
npm run test -- components/ProfileSettingsSheet.test.ts
```

Expected: PASS.

**Checkpoint**

Append checkpoint:

```markdown
### Checkpoint: Bottom Settings

- Added bottom settings entry for updating assistant name and MBTI after first setup.
- Verification: `npm run test -- components/ProfileSettingsSheet.test.ts`
```

---

### Task 13: End-To-End Flow

**Files:**
- Modify: `tests/e2e/main-flow.spec.ts`

**Step 1: Update E2E**

Cover:

- create a new key
- configure assistant name and MBTI
- enter experience
- send chat from bottom composer
- switch to design mode
- preview a design with mocked API
- save design
- reload and unlock with same key
- verify configuration is not shown again

**Step 2: Run E2E**

Run:

```bash
npx playwright test
```

Expected: PASS.

**Step 3: Full verification**

Run:

```bash
npm run test
npm run build
npx playwright test
```

Expected: PASS.

**Step 4: Browser visual check**

Open:

```text
http://127.0.0.1:3000/
```

Check desktop and mobile:

- create key flow
- first-time profile setup
- bottom composer spacing
- attachment menu
- design mode placeholder
- conversation opacity behavior
- settings sheet
- no mobile overlap

**Checkpoint**

Append checkpoint:

```markdown
### Checkpoint: Multi-Key AI Design Verification

- Ran full unit, build, and E2E verification for public key creation, key profile, bottom composer, and design mode.
- Checked desktop and mobile browser flows.
- Verification: `npm run test`; `npm run build`; `npx playwright test`
```

---

## Implementation Notes

### Safe AI Design Contract

The AI may only produce validated schema.

Allowed:

```json
{
  "version": 1,
  "theme": "star-letter",
  "palette": "rose-gold",
  "title": "给你的信",
  "subtitle": "有些话今天认真写给你。",
  "sections": [
    { "type": "letter", "text": "..." },
    { "type": "memory-map", "items": [{ "date": "5.20", "text": "..." }] },
    { "type": "star-scene", "density": 0.7, "caption": "..." }
  ]
}
```

Rejected:

- `<script>`
- inline event handlers
- raw CSS
- arbitrary HTML
- remote image URLs from model output unless later explicitly whitelisted
- schemas exceeding length or count limits

### Public Abuse Controls

Minimum limits for first implementation:

```ts
createPerIpPerDay: 5
createPerIpPerMinute: 1
chatPerKeyPerDay: 80
designPerKeyPerDay: 20
uploadPerKeyPerDay: 40
```

Return `429` with calm UI copy:

```text
今天的星光先到这里。
```

### Data Isolation Checklist

Every API that reads or writes user-generated data must use `event.context.keyId`.

Affected APIs:

- `/api/chat`
- `/api/memory`
- `/api/tts`
- `/api/image`
- `/api/music`
- `/api/video/tasks`
- `/api/video/tasks/[id]`
- `/api/design`
- `/api/design/preview`
- `/api/design/commit`
- `/api/key/profile`

### Backward Compatibility

Keep `100522` usable by creating a default key profile during migration or first unlock.
If this is not desired, remove this compatibility in Task 3 and update E2E accordingly.
