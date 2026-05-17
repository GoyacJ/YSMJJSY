# Agent Autonomy Governance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a controlled autonomy layer for each key agent: executable runtime state, manual sleep runs, memory governance, works library, planet timeline, and public universe visibility.

**Architecture:** Keep `/chat` as the main product surface. Add small SQLite-backed repositories and private agent APIs, then extend `AgentCorePanel` and `MemoryPlanetPanel` with state that is still derived from `/api/agent/core`. Do not introduce background workers in this pass; sleep runs are synchronous manual actions.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Nitro server routes, better-sqlite3, MiniMax client, Vitest, Vue Test Utils, Playwright, CSS.

---

## Implementation Rules

- Use TDD for every task.
- Keep changes scoped to the files listed in each task.
- Preserve existing chat generation semantics unless the task explicitly changes prompt context.
- Do not expose private key, conversation text, raw memory content, or IP/session fields through public APIs.
- Commit after each task if executing this plan in a clean branch.
- Before starting, commit or stash the current completed planet visualization work.

---

### Task 1: Add Agent Runtime State Repository

**Files:**
- Modify: `server/db/schema.ts`
- Modify: `server/db/sqlite.ts`
- Test: `server/db/sqlite.test.ts`

**Step 1: Write failing repository tests**

Add tests to `server/db/sqlite.test.ts`:

```ts
it('creates a default agent state for a key', () => {
  const repo = createAgentStateRepository(':memory:')

  const state = repo.getOrCreateAgentState('key_1', '2026-05-17T00:00:00.000Z')

  expect(state).toMatchObject({
    keyId: 'key_1',
    tone: '克制、温柔、安静',
    relationshipRole: '记忆星球守护者',
    learningMode: 'assisted',
    contentStrategy: {
      replyLength: 'balanced',
      structure: 'plain',
      initiative: 'low',
    },
  })
})

it('updates agent runtime state without changing unrelated fields', () => {
  const repo = createAgentStateRepository(':memory:')

  repo.getOrCreateAgentState('key_1', '2026-05-17T00:00:00.000Z')
  repo.updateAgentState('key_1', {
    tone: '更短',
    updatedAt: '2026-05-17T00:01:00.000Z',
  })

  expect(repo.getAgentState('key_1')).toMatchObject({
    keyId: 'key_1',
    tone: '更短',
    relationshipRole: '记忆星球守护者',
  })
})
```

**Step 2: Run failing tests**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected: FAIL because `createAgentStateRepository` does not exist.

**Step 3: Add schema**

In `server/db/schema.ts`, add:

```sql
CREATE TABLE IF NOT EXISTS agent_states (
  key_id TEXT PRIMARY KEY,
  tone TEXT NOT NULL,
  relationship_role TEXT NOT NULL,
  learning_mode TEXT NOT NULL,
  content_strategy_json TEXT NOT NULL,
  last_sleep_at TEXT,
  next_sleep_at TEXT,
  updated_at TEXT NOT NULL
)
```

**Step 4: Add types and repository**

In `server/db/sqlite.ts`, add:

```ts
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
```

Add `createAgentStateRepository(path: string)` with:

- `getAgentState(keyId)`
- `getOrCreateAgentState(keyId, now)`
- `updateAgentState(keyId, updates)`

Keep JSON parsing defensive. Invalid `content_strategy_json` should return the default strategy.

**Step 5: Run tests**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/db/schema.ts server/db/sqlite.ts server/db/sqlite.test.ts
git commit -m "feat: add agent runtime state"
```

---

### Task 2: Use Runtime State In Agent Core And Prompt Context

**Files:**
- Modify: `server/api/agent/core.get.ts`
- Modify: `server/services/star-chat.ts`
- Modify: `server/api/chat/stream.post.ts`
- Modify: `composables/useAgentCore.ts`
- Test: `server/api/agent.core.test.ts`
- Test: `server/services/star-chat.test.ts`

**Step 1: Write failing Agent Core test**

In `server/api/agent.core.test.ts`, add a test that passes an `agentState` into `buildAgentCoreResponse`:

```ts
expect(result.profile).toMatchObject({
  tone: '更短',
  relationshipRole: '长期记忆守护者',
  learningMode: 'assisted',
  contentStrategy: {
    replyLength: 'short',
  },
})
```

Expected: FAIL because `buildAgentCoreResponse` still hardcodes defaults.

**Step 2: Write failing prompt test**

In `server/services/star-chat.test.ts`, assert:

```ts
const messages = buildStarChatMessages({
  userMessage: '今天怎么聊？',
  assistantName: '月光',
  mbti: 'INTJ',
  tone: '更短',
  relationshipRole: '长期记忆守护者',
  contentStrategy: { replyLength: 'short', structure: 'plain', initiative: 'low' },
  memories: [],
  recentConversation: [],
})

expect(messages[0].content).toContain('语气：更短')
expect(messages[0].content).toContain('关系角色：长期记忆守护者')
expect(messages[0].content).toContain('回复长度：short')
```

Expected: FAIL because `contentStrategy` is not accepted or rendered.

**Step 3: Update Agent Core response**

In `server/api/agent/core.get.ts`:

- Import `createAgentStateRepository`.
- Load `agentState = getOrCreateAgentState(keyId, now)`.
- Pass it into `buildAgentCoreResponse`.
- Replace hardcoded `tone`, `relationshipRole`, and `learningMode`.
- Include `contentStrategy`.

**Step 4: Update frontend type**

In `composables/useAgentCore.ts`, add:

```ts
contentStrategy: {
  replyLength?: 'short' | 'balanced' | 'rich'
  structure?: 'plain' | 'letter' | 'checklist'
  initiative?: 'low' | 'medium'
}
```

**Step 5: Update chat prompt path**

In `server/api/chat/stream.post.ts`:

- Load `agentState`.
- Pass `tone`, `relationshipRole`, and `contentStrategy` into `buildStarChatMessages`.
- Pass `tone` and `relationshipRole` into `runAgentLearning`.

In `server/services/star-chat.ts`:

- Add `contentStrategy` to `BuildStarChatMessagesInput`.
- Render concise strategy lines into the system prompt.

**Step 6: Run tests**

Run:

```bash
npm run test -- server/api/agent.core.test.ts server/services/star-chat.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add server/api/agent/core.get.ts server/api/chat/stream.post.ts server/services/star-chat.ts composables/useAgentCore.ts server/api/agent.core.test.ts server/services/star-chat.test.ts
git commit -m "feat: use agent runtime state"
```

---

### Task 3: Apply Accepted Evolution Proposals

**Files:**
- Modify: `server/api/agent/proposals/[id].put.ts`
- Modify: `server/db/sqlite.ts`
- Test: `server/api/agent.core.test.ts`

**Step 1: Write failing proposal tests**

In `server/api/agent.core.test.ts`, update `applyAgentProposalAction` tests:

```ts
it('applies tone proposal into runtime state', () => {
  const updateAgentState = vi.fn()
  const updateProposal = vi.fn()
  const addSnapshot = vi.fn()

  const result = applyAgentProposalAction({
    keyId: 'key_1',
    proposalId: 'p1',
    action: 'accept',
    now: '2026-05-17T00:00:00.000Z',
    profile: { assistantName: '月光', mbti: 'INTJ' },
    agentState: {
      tone: '克制、温柔、安静',
      relationshipRole: '记忆星球守护者',
      learningMode: 'assisted',
      contentStrategy: {},
    },
    proposals: {
      listProposalsByKey: () => [{
        id: 'p1',
        keyId: 'key_1',
        type: 'tone',
        title: '更短',
        summary: '回复更短。',
        payloadJson: JSON.stringify({ tone: '更短' }),
        status: 'pending',
        createdAt: '2026-05-17T00:00:00.000Z',
        updatedAt: '2026-05-17T00:00:00.000Z',
      }],
      updateProposal,
    },
    snapshots: { addSnapshot },
    states: { updateAgentState },
    memories: { updateMemory: vi.fn() },
  })

  expect(result?.status).toBe('applied')
  expect(updateAgentState).toHaveBeenCalledWith('key_1', {
    tone: '更短',
    updatedAt: '2026-05-17T00:00:00.000Z',
  })
})
```

Expected: FAIL because accepted proposals do not update state.

**Step 2: Extend proposal type**

In `server/db/sqlite.ts`, extend `AgentEvolutionProposalRecord['type']`:

```ts
'tone' | 'relationship_role' | 'content_strategy' | 'memory_weight' | 'page_design'
```

**Step 3: Add memory update repository method**

In `createMemoryRepository`, add:

```ts
updateMemory(id: string, updates: {
  importance?: number
  status?: 'active' | 'archived' | 'rejected'
  updatedAt: string
}) {
  // Read current record first, then write only allowed fields.
}
```

Cover this in `server/db/sqlite.test.ts` if the existing proposal test needs a real repository.

**Step 4: Implement proposal application**

In `server/api/agent/proposals/[id].put.ts`:

- Load current agent state.
- On `reject`, keep behavior as `rejected`.
- On `accept`, write snapshot first.
- Apply proposal payload.
- Set proposal status to `applied`.

Mapping:

```ts
tone -> { tone: payload.tone }
relationship_role -> { relationshipRole: payload.relationshipRole }
content_strategy -> merge payload into contentStrategy
memory_weight -> update target memory importance
page_design -> leave proposal applied only if a design preview record is produced later; for this task keep it pending or reject unsupported payload
```

For MVP, do not apply `page_design` until Task 10.

**Step 5: Run tests**

Run:

```bash
npm run test -- server/api/agent.core.test.ts server/db/sqlite.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/api/agent/proposals/[id].put.ts server/db/sqlite.ts server/api/agent.core.test.ts server/db/sqlite.test.ts
git commit -m "feat: apply agent evolution proposals"
```

---

### Task 4: Add Sleep Run Parsing Service

**Files:**
- Modify: `server/services/agent-learning.ts`
- Test: `server/services/agent-learning.test.ts`

**Step 1: Write failing parser tests**

Add tests:

```ts
it('parses a sleep run result', () => {
  const result = parseAgentSleepResult(JSON.stringify({
    dailySummary: '今天用户确认了短句偏好。',
    memoryActions: [
      { memoryId: 'm1', action: 'confirm', reason: '用户明确表达。' },
    ],
    proposals: [
      {
        type: 'tone',
        title: '更短',
        summary: '后续回复更短。',
        payload: { tone: '更短' },
      },
    ],
    workIdeas: [
      { type: 'letter', title: '短句回信', summary: '写一封短回信。' },
    ],
    nextConversationHints: ['可以承接短句偏好。'],
  }))

  expect(result.dailySummary).toBe('今天用户确认了短句偏好。')
  expect(result.memoryActions[0]).toMatchObject({ memoryId: 'm1', action: 'confirm' })
  expect(result.proposals[0]).toMatchObject({ type: 'tone' })
})
```

Expected: FAIL because `parseAgentSleepResult` does not exist.

**Step 2: Add types**

In `server/services/agent-learning.ts`, add:

```ts
export type ParsedAgentSleepResult = {
  dailySummary: string
  memoryActions: Array<{
    memoryId: string
    action: 'confirm' | 'downgrade' | 'archive' | 'reject'
    reason: string
  }>
  proposals: ParsedAgentEvolutionProposal[]
  workIdeas: Array<{
    type: 'letter' | 'image' | 'music' | 'video' | 'page_design'
    title: string
    summary: string
  }>
  nextConversationHints: string[]
}
```

**Step 3: Add prompt builder**

Add:

```ts
export function buildAgentSleepMessages(input: {
  profile: { assistantName?: string, mbti?: string, tone?: string, relationshipRole?: string }
  memories: Array<{ id: string, content: string, importance: number, confidence: number }>
  reflections: string[]
  recentConversation: string[]
}): MiniMaxMessage[]
```

The system prompt must require strict JSON and forbid public disclosure decisions.

**Step 4: Implement parser**

Parse JSON defensively. Invalid items should be dropped. Invalid JSON should return empty arrays and empty summary.

**Step 5: Run tests**

Run:

```bash
npm run test -- server/services/agent-learning.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/services/agent-learning.ts server/services/agent-learning.test.ts
git commit -m "feat: parse agent sleep results"
```

---

### Task 5: Add Sleep Run Repository And API

**Files:**
- Modify: `server/db/schema.ts`
- Modify: `server/db/sqlite.ts`
- Create: `server/api/agent/sleep.post.ts`
- Test: `server/db/sqlite.test.ts`
- Test: `server/api/agent.sleep.test.ts`

**Step 1: Write failing repository tests**

Add:

```ts
it('stores and lists agent sleep runs by key', () => {
  const repo = createAgentSleepRepository(':memory:')

  repo.addSleepRun({
    id: 'sleep_1',
    keyId: 'key_1',
    status: 'completed',
    summary: '整理完成。',
    rawJson: '{}',
    startedAt: '2026-05-17T00:00:00.000Z',
    completedAt: '2026-05-17T00:01:00.000Z',
    error: null,
  })

  expect(repo.listSleepRunsByKey('key_1')[0]).toMatchObject({
    id: 'sleep_1',
    summary: '整理完成。',
  })
})
```

Expected: FAIL.

**Step 2: Add schema and repository**

Add `agent_sleep_runs` table from the design doc.

Add:

- `createAgentSleepRepository`
- `addSleepRun`
- `updateSleepRun`
- `listSleepRunsByKey(keyId, limit = 5)`
- `getLatestSleepRunByKey(keyId)`

**Step 3: Write API unit tests**

Create `server/api/agent.sleep.test.ts` for a pure function:

```ts
it('runs a manual sleep cycle and creates proposals', async () => {
  const result = await runManualAgentSleep({
    keyId: 'key_1',
    now: '2026-05-17T00:00:00.000Z',
    client: { reflectAgent: vi.fn(async () => JSON.stringify({
      dailySummary: '整理完成。',
      memoryActions: [],
      proposals: [{ type: 'tone', title: '更短', summary: '更短。', payload: { tone: '更短' } }],
      workIdeas: [],
      nextConversationHints: [],
    })) },
    // pass fake repos
  })

  expect(result.run.status).toBe('completed')
  expect(result.proposals).toHaveLength(1)
})
```

Expected: FAIL.

**Step 4: Implement API helper**

In `server/api/agent/sleep.post.ts`, export:

```ts
export async function runManualAgentSleep(input: ManualAgentSleepInput)
```

It should:

1. Add a `running` sleep run.
2. Build MiniMax messages from current profile, state, memories, reflections, recent conversations.
3. Call `client.reflectAgent`.
4. Parse result.
5. Add one `agent_reflections` row with the sleep summary.
6. Add pending proposals.
7. Update sleep run to `completed`.
8. Update `agent_states.lastSleepAt`.

On error, update sleep run to `failed` and rethrow a 502-style API error.

**Step 5: Implement event handler**

The default handler:

- Requires `keyId`.
- Loads all repositories.
- Calls `runManualAgentSleep`.
- Returns the run and created proposals.

**Step 6: Run tests**

Run:

```bash
npm run test -- server/db/sqlite.test.ts server/api/agent.sleep.test.ts server/services/agent-learning.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add server/db/schema.ts server/db/sqlite.ts server/api/agent/sleep.post.ts server/api/agent.sleep.test.ts server/db/sqlite.test.ts
git commit -m "feat: add manual agent sleep runs"
```

---

### Task 6: Show Sleep Cycle In Agent Core

**Files:**
- Modify: `composables/useAgentCore.ts`
- Modify: `components/AgentCorePanel.vue`
- Modify: `components/AgentCorePanel.test.ts`
- Modify: `assets/css/main.css`

**Step 1: Write failing component tests**

In `components/AgentCorePanel.test.ts`, add:

```ts
it('shows sleep status and can trigger a sleep run', async () => {
  const loadCore = vi.fn(async () => ({
    ...core,
    sleep: {
      lastSleepAt: null,
      nextSleepAt: '2026-05-17T12:00:00.000Z',
      latestRun: null,
    },
  }))
  const runSleep = vi.fn(async () => true)

  const wrapper = mount(AgentCorePanel, {
    props: { loadCore, runSleep, applyProposal: vi.fn() },
  })

  await wrapper.get('button[aria-label="打开 Agent Core"]').trigger('click')
  await flushPromises()

  expect(wrapper.text()).toContain('睡眠周期')
  await wrapper.get('button[aria-label="让智能体思考"]').trigger('click')
  expect(runSleep).toHaveBeenCalled()
})
```

Expected: FAIL.

**Step 2: Extend composable**

In `composables/useAgentCore.ts`:

- Add `sleep` type.
- Add `runSleep()`.
- `runSleep` posts to `/api/agent/sleep`, then calls `loadCore()`.

**Step 3: Extend component props**

In `AgentCorePanel.vue`, add optional prop:

```ts
runSleep?: () => Promise<boolean>
```

Default to `agentCore.runSleep`.

**Step 4: Render sleep section**

Add section after current status:

```text
睡眠周期
上次思考：...
最近报告：...
按钮：让它想一会儿
```

Disable button while pending.

**Step 5: Wire page**

In `pages/chat.vue`, pass shared `runSleep` into both standalone and embedded `AgentCorePanel`.

**Step 6: Run tests**

Run:

```bash
npm run test -- components/AgentCorePanel.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add composables/useAgentCore.ts components/AgentCorePanel.vue components/AgentCorePanel.test.ts pages/chat.vue assets/css/main.css
git commit -m "feat: show agent sleep cycle"
```

---

### Task 7: Add Memory Governance API

**Files:**
- Modify: `server/db/schema.ts`
- Modify: `server/db/sqlite.ts`
- Create: `server/api/agent/memories/[id].put.ts`
- Test: `server/db/sqlite.test.ts`
- Test: `server/api/agent.memory.test.ts`

**Step 1: Write failing repository tests**

Add tests for `memory_events`:

```ts
it('records memory governance events', () => {
  const repo = createMemoryEventRepository(':memory:')

  repo.addMemoryEvent({
    id: 'event_1',
    keyId: 'key_1',
    memoryId: 'memory_1',
    action: 'archive',
    beforeJson: '{"status":"active"}',
    afterJson: '{"status":"archived"}',
    reason: '用户要求不再使用。',
    createdAt: '2026-05-17T00:00:00.000Z',
  })

  expect(repo.listMemoryEventsByKey('key_1')[0]).toMatchObject({
    memoryId: 'memory_1',
    action: 'archive',
  })
})
```

Expected: FAIL.

**Step 2: Add memory event schema and repository**

Add `memory_events` table.

Add:

- `createMemoryEventRepository`
- `addMemoryEvent`
- `listMemoryEventsByKey`
- `listMemoryEventsByMemory`

**Step 3: Write API tests**

Create pure helper tests:

```ts
it('archives a memory and records before and after snapshots', () => {
  const updateMemory = vi.fn()
  const addMemoryEvent = vi.fn()

  const result = applyMemoryGovernanceAction({
    keyId: 'key_1',
    memoryId: 'memory_1',
    action: 'archive',
    reason: '不再使用',
    now: '2026-05-17T00:00:00.000Z',
    memories: {
      getMemoryByKey: () => ({
        id: 'memory_1',
        keyId: 'key_1',
        type: 'preference',
        content: '用户喜欢短句。',
        importance: 0.8,
        confidence: 0.9,
        status: 'active',
        createdAt: '2026-05-17T00:00:00.000Z',
      }),
      updateMemory,
    },
    events: { addMemoryEvent },
  })

  expect(result.status).toBe('archived')
  expect(updateMemory).toHaveBeenCalled()
  expect(addMemoryEvent).toHaveBeenCalled()
})
```

Expected: FAIL.

**Step 4: Add memory repository methods**

In `createMemoryRepository`, add:

- `getMemoryByKey(keyId, id)`
- `updateMemory(id, updates)`

**Step 5: Implement API**

In `server/api/agent/memories/[id].put.ts`:

- Require key.
- Parse action.
- Apply:
  - `confirm`: event only.
  - `downgrade`: `importance = max(0, importance - 0.2)`.
  - `archive`: `status = archived`.
  - `reject`: `status = rejected`.
- Record before/after JSON.

**Step 6: Run tests**

Run:

```bash
npm run test -- server/api/agent.memory.test.ts server/db/sqlite.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add server/db/schema.ts server/db/sqlite.ts server/api/agent/memories/[id].put.ts server/api/agent.memory.test.ts server/db/sqlite.test.ts
git commit -m "feat: add memory governance actions"
```

---

### Task 8: Add Memory Governance UI

**Files:**
- Modify: `composables/useAgentCore.ts`
- Modify: `components/MemoryPlanetPanel.vue`
- Modify: `components/MemoryPlanetPanel.test.ts`
- Modify: `assets/css/main.css`

**Step 1: Write failing component test**

In `components/MemoryPlanetPanel.test.ts`, add:

```ts
it('shows memory governance actions for a selected memory', async () => {
  const governMemory = vi.fn(async () => true)
  const wrapper = mount(MemoryPlanetPanel, {
    props: { core, open: true, governMemory },
  })

  await wrapper.get('button[aria-label="查看记忆：用户喜欢短句。"]').trigger('click')

  expect(wrapper.text()).toContain('重要性')
  expect(wrapper.get('button[aria-label="归档记忆"]').exists()).toBe(true)

  await wrapper.get('button[aria-label="归档记忆"]').trigger('click')
  expect(governMemory).toHaveBeenCalledWith('memory_1', 'archive')
})
```

Expected: FAIL.

**Step 2: Add composable action**

In `useAgentCore`, add:

```ts
async function governMemory(id: string, action: MemoryGovernanceAction, reason = '') {
  await $fetch(`/api/agent/memories/${id}`, {
    method: 'PUT',
    body: { action, reason },
  })
  await loadCore()
  return true
}
```

**Step 3: Add panel props and buttons**

In `MemoryPlanetPanel.vue`, add optional prop:

```ts
governMemory?: (id: string, action: MemoryGovernanceAction) => Promise<boolean>
```

Render selected memory fields:

- type
- importance
- confidence
- actions

Buttons:

- 确认
- 降权
- 归档
- 拒绝

**Step 4: Wire page**

In `pages/chat.vue`, pass shared `governMemory` into `MemoryPlanetPanel`.

**Step 5: Run tests**

Run:

```bash
npm run test -- components/MemoryPlanetPanel.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add composables/useAgentCore.ts components/MemoryPlanetPanel.vue components/MemoryPlanetPanel.test.ts pages/chat.vue assets/css/main.css
git commit -m "feat: add memory governance UI"
```

---

### Task 9: Add Agent Works Repository And Private API

**Files:**
- Modify: `server/db/schema.ts`
- Modify: `server/db/sqlite.ts`
- Create: `server/api/agent/works.get.ts`
- Create: `server/api/agent/works/[id].put.ts`
- Test: `server/db/sqlite.test.ts`
- Test: `server/api/agent.works.test.ts`

**Step 1: Write repository tests**

Add:

```ts
it('stores private agent works by key', () => {
  const repo = createAgentWorkRepository(':memory:')

  repo.addWork({
    id: 'work_1',
    keyId: 'key_1',
    type: 'image',
    title: '月光图',
    summary: '一张月光星空。',
    sourceConversationId: 'c1',
    sourceMediaTaskId: null,
    sourceDesignVersion: null,
    previewUrl: 'data:image/png;base64,abc',
    payloadJson: '{}',
    visibility: 'private',
    createdAt: '2026-05-17T00:00:00.000Z',
    updatedAt: '2026-05-17T00:00:00.000Z',
  })

  expect(repo.listWorksByKey('key_1')[0]).toMatchObject({
    id: 'work_1',
    type: 'image',
    visibility: 'private',
  })
})
```

Expected: FAIL.

**Step 2: Add schema and repository**

Add `agent_works` table.

Add repository:

- `addWork`
- `listWorksByKey`
- `getWorkByKey`
- `updateWorkVisibility`
- `listPublicWorks`

**Step 3: Add API tests**

Test:

- unauthenticated request fails.
- `GET /api/agent/works` returns only current key works.
- `PUT /api/agent/works/:id` updates `visibility`.

Use pure mapper/helper functions where possible.

**Step 4: Implement APIs**

`server/api/agent/works.get.ts`:

- require key.
- return works sorted newest first.

`server/api/agent/works/[id].put.ts`:

- require key.
- body `{ visibility: 'private' | 'public' }`.
- update only current key work.

**Step 5: Run tests**

Run:

```bash
npm run test -- server/db/sqlite.test.ts server/api/agent.works.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/db/schema.ts server/db/sqlite.ts server/api/agent/works.get.ts server/api/agent/works/[id].put.ts server/db/sqlite.test.ts server/api/agent.works.test.ts
git commit -m "feat: add agent works API"
```

---

### Task 10: Capture Works From Chat And Design

**Files:**
- Modify: `server/api/chat/stream.post.ts`
- Modify: `server/api/design/commit.post.ts`
- Test: `server/api/chat.post.test.ts`
- Test: `server/api/design.test.ts`

**Step 1: Write failing chat work tests**

In `server/api/chat.post.test.ts`, add a pure helper test:

```ts
it('maps assistant media message parts to agent works', () => {
  const works = buildWorksFromAssistantMessage({
    keyId: 'key_1',
    conversationId: 'assistant_1',
    now: '2026-05-17T00:00:00.000Z',
    message: {
      role: 'assistant',
      content: '画好了。',
      parts: [{ type: 'image', url: 'https://example.com/moon.png' }],
    },
  })

  expect(works[0]).toMatchObject({
    type: 'image',
    title: '画好了。',
    previewUrl: 'https://example.com/moon.png',
    visibility: 'private',
  })
})
```

Expected: FAIL.

**Step 2: Add mapper**

In `server/api/chat/stream.post.ts`, export:

```ts
export function buildWorksFromAssistantMessage(input): AgentWorkRecord[]
```

Map:

- `image` part -> image work.
- `music` part -> music work.
- `video` part -> video work.
- long text with no media -> no work in MVP unless intent is `chat` and content length exceeds threshold.

**Step 3: Insert works after assistant conversation save**

After `conversations.addConversation` for assistant:

- Build works from message.
- Insert via `createAgentWorkRepository`.
- Catch errors so work capture does not hide the reply.

**Step 4: Write failing design work test**

In `server/api/design.test.ts`, assert design commit creates a page design work through a helper:

```ts
expect(buildWorkFromCommittedDesign(...)).toMatchObject({
  type: 'page_design',
  visibility: 'private',
})
```

**Step 5: Add mapper and insert in design commit**

In `server/api/design/commit.post.ts`:

- After committing design version, add `page_design` work.
- Store design schema in `payloadJson`.

**Step 6: Run tests**

Run:

```bash
npm run test -- server/api/chat.post.test.ts server/api/design.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add server/api/chat/stream.post.ts server/api/design/commit.post.ts server/api/chat.post.test.ts server/api/design.test.ts
git commit -m "feat: capture agent works"
```

---

### Task 11: Add Timeline API

**Files:**
- Create: `server/api/agent/timeline.get.ts`
- Test: `server/api/agent.timeline.test.ts`
- Modify: `composables/useAgentCore.ts`

**Step 1: Write failing timeline mapper tests**

Create:

```ts
it('builds a sorted agent timeline from memories, reflections, proposals, sleep runs, and works', () => {
  const timeline = buildAgentTimeline({
    profile: { createdAt: '2026-05-17T00:00:00.000Z', configuredAt: '2026-05-17T00:01:00.000Z' },
    memories: [{ id: 'm1', content: '用户喜欢短句。', createdAt: '2026-05-17T00:02:00.000Z' }],
    reflections: [{ id: 'r1', summary: '形成短句偏好。', createdAt: '2026-05-17T00:03:00.000Z' }],
    proposals: [],
    sleepRuns: [],
    works: [],
  })

  expect(timeline.map(item => item.type)).toEqual(['profile', 'memory', 'reflection', 'key'])
})
```

Expected: FAIL.

**Step 2: Implement mapper**

In `server/api/agent/timeline.get.ts`, export:

```ts
export type AgentTimelineItem = {
  id: string
  type: 'key' | 'profile' | 'memory' | 'reflection' | 'sleep' | 'proposal' | 'work' | 'design'
  title: string
  summary: string
  createdAt: string
}
```

Sort newest first.

Only include high-signal events.

**Step 3: Implement handler**

Handler:

- Require key.
- Load profile, memories, reflections, proposals, sleep runs, works.
- Return `{ items }`.

**Step 4: Add composable method**

In `useAgentCore`, add:

```ts
async function loadTimeline()
```

**Step 5: Run tests**

Run:

```bash
npm run test -- server/api/agent.timeline.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/api/agent/timeline.get.ts server/api/agent.timeline.test.ts composables/useAgentCore.ts
git commit -m "feat: add agent timeline API"
```

---

### Task 12: Show Works And Timeline In Memory Planet

**Files:**
- Modify: `components/MemoryPlanetPanel.vue`
- Modify: `components/MemoryPlanetPanel.test.ts`
- Modify: `composables/useAgentCore.ts`
- Modify: `pages/chat.vue`
- Modify: `assets/css/main.css`

**Step 1: Write failing component test**

Add:

```ts
it('switches between planet, timeline, and works views', async () => {
  const wrapper = mount(MemoryPlanetPanel, {
    props: {
      core,
      open: true,
      timeline: [{ id: 't1', type: 'memory', title: '形成记忆', summary: '用户喜欢短句。', createdAt: '2026-05-17T00:00:00.000Z' }],
      works: [{ id: 'w1', type: 'image', title: '月光图', summary: '一张图。', visibility: 'private', createdAt: '2026-05-17T00:00:00.000Z' }],
    },
  })

  await wrapper.get('button[aria-label="查看星球时间线"]').trigger('click')
  expect(wrapper.text()).toContain('形成记忆')

  await wrapper.get('button[aria-label="查看智能体作品"]').trigger('click')
  expect(wrapper.text()).toContain('月光图')
})
```

Expected: FAIL.

**Step 2: Extend panel props**

Add:

- `timeline`
- `works`
- `loadTimeline`
- `loadWorks`
- `updateWorkVisibility`

**Step 3: Add tabs**

Render segmented controls:

- 星球
- 时间线
- 作品

On tab switch, call loader if data is not loaded.

**Step 4: Add composable methods**

In `useAgentCore`:

- `loadWorks`
- `updateWorkVisibility`
- `loadTimeline`

**Step 5: Wire page**

In `pages/chat.vue`, pass methods and readonly data into `MemoryPlanetPanel`.

**Step 6: Run tests**

Run:

```bash
npm run test -- components/MemoryPlanetPanel.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add components/MemoryPlanetPanel.vue components/MemoryPlanetPanel.test.ts composables/useAgentCore.ts pages/chat.vue assets/css/main.css
git commit -m "feat: show agent works and timeline"
```

---

### Task 13: Extend Public Universe With Explicit Public Works

**Files:**
- Modify: `server/api/public-stars.get.ts`
- Modify: `server/api/public-stars.get.test.ts`
- Modify: `utils/public-star-scene.ts`
- Modify: `utils/public-star-scene.test.ts`
- Modify: `components/PublicStarHome.client.vue`
- Test: `components/PublicStarHome.test.ts`

**Step 1: Write failing public API tests**

In `server/api/public-stars.get.test.ts`, assert:

```ts
expect(mapPublicStar({
  id: 'key_1',
  name: '月光',
  mbti: 'INTJ',
  createdAt: '2026-05-17T00:00:00.000Z',
  activityAt: null,
  activityKind: null,
  publicWorks: [
    { id: 'w1', type: 'image', title: '月光图', summary: '公开作品。' },
  ],
})).toMatchObject({
  id: 'key_1',
  name: '月光',
  publicWorks: [{ id: 'w1', title: '月光图' }],
})
```

Expected: FAIL.

**Step 2: Extend API mapper**

Only include works with `visibility = public`.

Do not include:

- conversation IDs.
- payload JSON.
- private preview data if it is a data URL.

For public works, include:

```ts
{
  id: string
  type: AgentWorkType
  title: string
  summary: string
}
```

**Step 3: Extend scene utility**

In `utils/public-star-scene.ts`, derive a stronger glow or satellite mark when a star has public works.

**Step 4: Extend public component**

In `PublicStarHome.client.vue`, render public work count or public work labels without exposing private text.

**Step 5: Run tests**

Run:

```bash
npm run test -- server/api/public-stars.get.test.ts utils/public-star-scene.test.ts components/PublicStarHome.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/api/public-stars.get.ts server/api/public-stars.get.test.ts utils/public-star-scene.ts utils/public-star-scene.test.ts components/PublicStarHome.client.vue components/PublicStarHome.test.ts
git commit -m "feat: show public agent works"
```

---

### Task 14: End-To-End Flow

**Files:**
- Modify: `tests/e2e/main-flow.spec.ts`

**Step 1: Add mocked API routes**

Extend e2e mocks for:

- `POST /api/agent/sleep`
- `PUT /api/agent/memories/*`
- `GET /api/agent/works`
- `GET /api/agent/timeline`
- `PUT /api/agent/works/*`

**Step 2: Add user flow**

Add checks:

1. Open `/chat`.
2. Open Agent Core.
3. Click `让它想一会儿`.
4. Confirm sleep report appears.
5. Open Memory Planet.
6. Select memory.
7. Archive memory.
8. Switch to timeline.
9. Switch to works.
10. Toggle one work public.

**Step 3: Run e2e**

Run:

```bash
npm run test:e2e
```

Expected: PASS for chromium and mobile.

**Step 4: Commit**

```bash
git add tests/e2e/main-flow.spec.ts
git commit -m "test: cover agent autonomy flow"
```

---

### Task 15: Full Verification

**Files:**
- No code changes unless verification fails.

**Step 1: Run focused tests**

Run:

```bash
npm run test -- server/db/sqlite.test.ts server/services/agent-learning.test.ts server/api/agent.core.test.ts server/api/agent.sleep.test.ts server/api/agent.memory.test.ts server/api/agent.works.test.ts server/api/agent.timeline.test.ts components/AgentCorePanel.test.ts components/MemoryPlanetPanel.test.ts
```

Expected: PASS.

**Step 2: Run full unit suite**

Run:

```bash
npm run test
```

Expected: PASS.

**Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

**Step 4: Run e2e**

Run:

```bash
npm run test:e2e
```

Expected: PASS.

**Step 5: Inspect public privacy**

Manually inspect `server/api/public-stars.get.ts`.

Confirm response does not include:

- key lookup hash
- created IP hash
- session token
- raw conversation text
- private memory content
- private work payload JSON

**Step 6: Commit final verification note if needed**

If the project tracks checkpoints in this plan, append:

```markdown
### Verification
- `npm run test`: PASS
- `npm run build`: PASS
- `npm run test:e2e`: PASS
```

Commit:

```bash
git add docs/plans/2026-05-17-agent-autonomy-governance-implementation.md
git commit -m "docs: record agent autonomy verification"
```

