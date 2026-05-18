# Agent OS Layered Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an Agent OS foundation under the existing star/key business layer without breaking the current chat, memory planet, works, and public universe flows.

**Architecture:** Add a compatibility layer first: every existing key gets an Agent instance and binding, while current `key_id` tables continue to work. Introduce task, event, inbox, and OS aggregation APIs, then connect them to `AgentCorePanel` as the business-facing console. Keep MiniMax and existing agent APIs working; provider and tool registry abstractions are introduced as typed seams before deep migration.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Nitro server routes, better-sqlite3, Vitest, Vue Test Utils, Playwright, CSS.

---

## Execution Rules

- Work task by task.
- Use TDD for behavior changes.
- Keep existing `/api/agent/*` endpoints compatible.
- Do not expose private memory, raw conversation text, key hashes, IP hashes, sessions, or raw model payloads through new public or OS APIs.
- Commit after each task.
- If a task changes UI behavior, run the related component test and the main E2E test.

## Current Baseline

Current clean baseline includes:

- `AgentCorePanel` as standalone 星AI entry.
- `MemoryPlanetPanel` without embedded Agent Core.
- `GET /api/agent/core`.
- `POST /api/agent/sleep`.
- `GET /api/agent/timeline`.
- `GET /api/agent/works`.
- proposal apply, design preview, memory governance, works visibility, rollback.

Before starting, run:

```bash
git status --short
npm run test
npm run build
```

Expected:

- Clean or only intentional doc changes.
- Unit tests pass.
- Build passes.

---

### Task 1: Add Agent Instance And Binding Storage

**Files:**

- Modify: `server/db/schema.ts`
- Modify: `server/db/sqlite.ts`
- Test: `server/db/sqlite.test.ts`

**Step 1: Write failing repository tests**

In `server/db/sqlite.test.ts`, add tests for:

```ts
it('creates and reuses an agent instance for a key binding', () => {
  const repo = createAgentInstanceRepository(':memory:')
  const now = '2026-05-18T00:00:00.000Z'

  const first = repo.getOrCreateAgentForOwner({
    ownerType: 'key',
    ownerId: 'key_1',
    domain: 'star',
    now,
  })
  const second = repo.getOrCreateAgentForOwner({
    ownerType: 'key',
    ownerId: 'key_1',
    domain: 'star',
    now: '2026-05-18T00:01:00.000Z',
  })

  expect(first.id).toBe(second.id)
  expect(first.status).toBe('active')
  expect(second.ownerId).toBe('key_1')
})
```

Add a second test:

```ts
it('keeps separate agent bindings for separate keys', () => {
  const repo = createAgentInstanceRepository(':memory:')
  const now = '2026-05-18T00:00:00.000Z'

  const one = repo.getOrCreateAgentForOwner({ ownerType: 'key', ownerId: 'key_1', domain: 'star', now })
  const two = repo.getOrCreateAgentForOwner({ ownerType: 'key', ownerId: 'key_2', domain: 'star', now })

  expect(one.id).not.toBe(two.id)
})
```

**Step 2: Run test to verify failure**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected: FAIL because `createAgentInstanceRepository` does not exist.

**Step 3: Add schema**

In `server/db/schema.ts`, add:

```ts
`CREATE TABLE IF NOT EXISTS agent_instances (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
`CREATE TABLE IF NOT EXISTS agent_bindings (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(owner_type, owner_id, domain)
)`,
```

**Step 4: Add types and repository**

In `server/db/sqlite.ts`, add:

```ts
export type AgentOwnerType = 'key' | 'universe' | 'project'
export type AgentDomain = 'star'

export type AgentInstanceRecord = {
  id: string
  status: 'active' | 'paused' | 'archived'
  createdAt: string
  updatedAt: string
}

export type AgentBindingRecord = {
  id: string
  agentId: string
  ownerType: AgentOwnerType
  ownerId: string
  domain: AgentDomain
  createdAt: string
}

export type AgentForOwnerRecord = AgentInstanceRecord & {
  bindingId: string
  ownerType: AgentOwnerType
  ownerId: string
  domain: AgentDomain
}
```

Add repository:

```ts
export function createAgentInstanceRepository(path: string) {
  const db = openDatabase(path)

  return {
    getOrCreateAgentForOwner(input: {
      ownerType: AgentOwnerType
      ownerId: string
      domain: AgentDomain
      now: string
    }): AgentForOwnerRecord {
      const existing = db.prepare(`
        SELECT
          ai.id,
          ai.status,
          ai.created_at AS createdAt,
          ai.updated_at AS updatedAt,
          ab.id AS bindingId,
          ab.owner_type AS ownerType,
          ab.owner_id AS ownerId,
          ab.domain AS domain
        FROM agent_bindings ab
        JOIN agent_instances ai ON ai.id = ab.agent_id
        WHERE ab.owner_type = ? AND ab.owner_id = ? AND ab.domain = ?
      `).get(input.ownerType, input.ownerId, input.domain) as AgentForOwnerRecord | undefined

      if (existing) {
        return existing
      }

      const agentId = `agent_${crypto.randomUUID()}`
      const bindingId = `binding_${crypto.randomUUID()}`

      db.prepare(`
        INSERT INTO agent_instances (id, status, created_at, updated_at)
        VALUES (?, 'active', ?, ?)
      `).run(agentId, input.now, input.now)

      db.prepare(`
        INSERT INTO agent_bindings (id, agent_id, owner_type, owner_id, domain, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(bindingId, agentId, input.ownerType, input.ownerId, input.domain, input.now)

      return {
        id: agentId,
        status: 'active',
        createdAt: input.now,
        updatedAt: input.now,
        bindingId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        domain: input.domain,
      }
    },
  }
}
```

If `crypto.randomUUID()` is unavailable in the test environment, import `nanoid` and use `nanoid()`.

**Step 5: Run test**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/db/schema.ts server/db/sqlite.ts server/db/sqlite.test.ts
git commit -m "feat: add agent instance bindings"
```

---

### Task 2: Add Agent Task And Event Storage

**Files:**

- Modify: `server/db/schema.ts`
- Modify: `server/db/sqlite.ts`
- Test: `server/db/sqlite.test.ts`

**Step 1: Write failing tests**

Add:

```ts
it('stores and updates agent tasks by agent id', () => {
  const repo = createAgentTaskRepository(':memory:')
  repo.addTask({
    id: 'task_1',
    agentId: 'agent_1',
    type: 'reflect',
    status: 'queued',
    title: '整理最近对话',
    summary: '提炼最近对话。',
    inputJson: '{"source":"chat"}',
    resultJson: null,
    error: null,
    createdAt: '2026-05-18T00:00:00.000Z',
    updatedAt: '2026-05-18T00:00:00.000Z',
  })

  repo.updateTask('task_1', {
    status: 'completed',
    resultJson: '{"summary":"完成"}',
    updatedAt: '2026-05-18T00:01:00.000Z',
  })

  expect(repo.listTasksByAgent('agent_1')).toMatchObject([
    { id: 'task_1', status: 'completed', resultJson: '{"summary":"完成"}' },
  ])
})
```

Add:

```ts
it('records agent events by agent id', () => {
  const repo = createAgentEventRepository(':memory:')
  repo.addEvent({
    id: 'event_1',
    agentId: 'agent_1',
    type: 'task.completed',
    title: '任务完成',
    summary: '整理完成。',
    targetType: 'task',
    targetId: 'task_1',
    payloadJson: '{}',
    visibility: 'private',
    createdAt: '2026-05-18T00:00:00.000Z',
  })

  expect(repo.listEventsByAgent('agent_1')).toMatchObject([
    { id: 'event_1', type: 'task.completed', visibility: 'private' },
  ])
})
```

**Step 2: Run test to verify failure**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected: FAIL because repositories do not exist.

**Step 3: Add schema**

Add:

```ts
`CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  input_json TEXT NOT NULL,
  result_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
`CREATE TABLE IF NOT EXISTS agent_events (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  payload_json TEXT NOT NULL,
  visibility TEXT NOT NULL,
  created_at TEXT NOT NULL
)`,
```

**Step 4: Add types**

Add to `server/db/sqlite.ts`:

```ts
export type AgentTaskStatus = 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled'
export type AgentTaskType = 'reflect' | 'sleep' | 'govern_memory' | 'propose_evolution' | 'generate_artifact' | 'preview_design' | 'publish_artifact'

export type AgentTaskRecord = {
  id: string
  agentId: string
  type: AgentTaskType
  status: AgentTaskStatus
  title: string
  summary: string
  inputJson: string
  resultJson?: string | null
  error?: string | null
  createdAt: string
  updatedAt: string
}

export type AgentEventRecord = {
  id: string
  agentId: string
  type: string
  title: string
  summary: string
  targetType?: string | null
  targetId?: string | null
  payloadJson: string
  visibility: 'private' | 'public'
  createdAt: string
}
```

**Step 5: Add repositories**

Add `createAgentTaskRepository` with:

- `addTask(record)`
- `updateTask(id, updates)`
- `getTask(id)`
- `listTasksByAgent(agentId, limit = 20)`

Add `createAgentEventRepository` with:

- `addEvent(record)`
- `listEventsByAgent(agentId, limit = 40)`

Use the same SQL style as existing repositories.

**Step 6: Run test**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add server/db/schema.ts server/db/sqlite.ts server/db/sqlite.test.ts
git commit -m "feat: add agent tasks and events"
```

---

### Task 3: Add Agent OS Aggregation Service

**Files:**

- Create: `server/services/agent-os.ts`
- Test: `server/services/agent-os.test.ts`

**Step 1: Write failing tests**

Create `server/services/agent-os.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildAgentOsResponse, buildAgentInbox } from './agent-os'

describe('agent os service', () => {
  it('builds a private OS response from agent records', () => {
    const result = buildAgentOsResponse({
      agent: {
        id: 'agent_1',
        status: 'active',
        createdAt: '2026-05-18T00:00:00.000Z',
        updatedAt: '2026-05-18T00:00:00.000Z',
        bindingId: 'binding_1',
        ownerType: 'key',
        ownerId: 'key_1',
        domain: 'star',
      },
      tasks: [
        {
          id: 'task_1',
          agentId: 'agent_1',
          type: 'sleep',
          status: 'completed',
          title: '睡眠整理',
          summary: '整理完成。',
          inputJson: '{}',
          resultJson: '{"dailySummary":"整理完成。"}',
          error: null,
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:01:00.000Z',
        },
      ],
      events: [
        {
          id: 'event_1',
          agentId: 'agent_1',
          type: 'task.completed',
          title: '任务完成',
          summary: '整理完成。',
          targetType: 'task',
          targetId: 'task_1',
          payloadJson: '{"private":"hidden"}',
          visibility: 'private',
          createdAt: '2026-05-18T00:01:00.000Z',
        },
      ],
      pendingProposals: [
        {
          id: 'proposal_1',
          keyId: 'key_1',
          reflectionId: null,
          type: 'tone',
          title: '更短',
          summary: '回复更短。',
          payloadJson: '{"tone":"更短"}',
          status: 'pending',
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
        },
      ],
      publicWorkCandidates: [],
    })

    expect(result.agent.id).toBe('agent_1')
    expect(result.tasks[0].status).toBe('completed')
    expect(result.events[0]).not.toHaveProperty('payload')
    expect(result.inbox).toMatchObject([{ id: 'proposal_1', type: 'proposal', title: '更短' }])
  })

  it('builds inbox items for proposals and public work candidates', () => {
    expect(buildAgentInbox({
      pendingProposals: [],
      publicWorkCandidates: [
        {
          id: 'work_1',
          keyId: 'key_1',
          type: 'image',
          title: '月光图',
          summary: '一张图。',
          payloadJson: '{}',
          visibility: 'private',
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
        },
      ],
    })).toMatchObject([
      { id: 'work_1', type: 'work_visibility', action: 'publish' },
    ])
  })
})
```

**Step 2: Run test to verify failure**

Run:

```bash
npm run test -- server/services/agent-os.test.ts
```

Expected: FAIL because service does not exist.

**Step 3: Implement service**

Create `server/services/agent-os.ts` with exported helpers:

- `parseJsonObject(value)`
- `buildAgentInbox(input)`
- `buildAgentOsResponse(input)`

Output shape:

```ts
export type AgentOsInboxItem = {
  id: string
  type: 'proposal' | 'work_visibility'
  title: string
  summary: string
  action: 'approve' | 'publish'
  createdAt: string
}

export type AgentOsResponse = {
  agent: {
    id: string
    status: string
    ownerType: string
    ownerId: string
    domain: string
  }
  inbox: AgentOsInboxItem[]
  tasks: Array<{
    id: string
    type: string
    status: string
    title: string
    summary: string
    result?: Record<string, unknown>
    error?: string | null
    createdAt: string
    updatedAt: string
  }>
  events: Array<{
    id: string
    type: string
    title: string
    summary: string
    targetType?: string | null
    targetId?: string | null
    createdAt: string
  }>
}
```

Do not expose event `payloadJson`.

**Step 4: Run test**

Run:

```bash
npm run test -- server/services/agent-os.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add server/services/agent-os.ts server/services/agent-os.test.ts
git commit -m "feat: add agent os aggregation service"
```

---

### Task 4: Add Current Agent OS API

**Files:**

- Create: `server/api/agents/current/os.get.ts`
- Create: `server/api/agent.os.test.ts`
- Modify: `server/api/agent/core.get.ts`

**Step 1: Write API helper test**

Create `server/api/agent.os.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildCurrentAgentOsResponse } from './agents/current/os.get'

describe('agent os api helpers', () => {
  it('returns os state for the current key agent', () => {
    const result = buildCurrentAgentOsResponse({
      keyId: 'key_1',
      now: '2026-05-18T00:00:00.000Z',
      agents: {
        getOrCreateAgentForOwner: () => ({
          id: 'agent_1',
          status: 'active',
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
          bindingId: 'binding_1',
          ownerType: 'key',
          ownerId: 'key_1',
          domain: 'star',
        }),
      },
      tasks: { listTasksByAgent: () => [] },
      events: { listEventsByAgent: () => [] },
      proposals: { listProposalsByKey: () => [] },
      works: { listWorksByKey: () => [] },
    })

    expect(result.agent).toMatchObject({ id: 'agent_1', ownerId: 'key_1' })
  })
})
```

**Step 2: Run test to verify failure**

Run:

```bash
npm run test -- server/api/agent.os.test.ts
```

Expected: FAIL because API helper does not exist.

**Step 3: Implement route**

Create `server/api/agents/current/os.get.ts`.

Route behavior:

- Require current key through `requireAgentKey`.
- Resolve current key's Agent with `createAgentInstanceRepository`.
- Load tasks and events by `agent.id`.
- Load pending proposals by `keyId`.
- Load private works by `keyId` as publish candidates.
- Return `buildAgentOsResponse`.

Export helper:

```ts
export function buildCurrentAgentOsResponse(input: {
  keyId: string
  now: string
  agents: Pick<ReturnType<typeof createAgentInstanceRepository>, 'getOrCreateAgentForOwner'>
  tasks: Pick<ReturnType<typeof createAgentTaskRepository>, 'listTasksByAgent'>
  events: Pick<ReturnType<typeof createAgentEventRepository>, 'listEventsByAgent'>
  proposals: Pick<ReturnType<typeof createAgentEvolutionRepository>, 'listProposalsByKey'>
  works: Pick<ReturnType<typeof createAgentWorkRepository>, 'listWorksByKey'>
}) {
  const agent = input.agents.getOrCreateAgentForOwner({
    ownerType: 'key',
    ownerId: input.keyId,
    domain: 'star',
    now: input.now,
  })

  return buildAgentOsResponse({
    agent,
    tasks: input.tasks.listTasksByAgent(agent.id),
    events: input.events.listEventsByAgent(agent.id),
    pendingProposals: input.proposals.listProposalsByKey(input.keyId, 'pending'),
    publicWorkCandidates: input.works
      .listWorksByKey(input.keyId)
      .filter(work => work.visibility === 'private'),
  })
}
```

**Step 4: Run test**

Run:

```bash
npm run test -- server/api/agent.os.test.ts server/services/agent-os.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add server/api/agents/current/os.get.ts server/api/agent.os.test.ts server/api/agent/core.get.ts server/services/agent-os.ts
git commit -m "feat: expose current agent os state"
```

---

### Task 5: Wrap Sleep Runs As Agent Tasks And Events

**Files:**

- Modify: `server/api/agent/sleep.post.ts`
- Test: `server/api/agent.sleep.test.ts`
- Test: `server/api/agent.os.test.ts`

**Step 1: Add failing test**

In `server/api/agent.sleep.test.ts`, add a helper-level test that calls `runManualAgentSleep` with fake task and event repositories.

Expected assertions:

```ts
expect(tasks.addTask).toHaveBeenCalledWith(expect.objectContaining({
  type: 'sleep',
  status: 'running',
}))
expect(tasks.updateTask).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
  status: 'completed',
}))
expect(events.addEvent).toHaveBeenCalledWith(expect.objectContaining({
  type: 'task.completed',
  targetType: 'task',
}))
```

**Step 2: Run test to verify failure**

Run:

```bash
npm run test -- server/api/agent.sleep.test.ts
```

Expected: FAIL because sleep does not write OS tasks/events.

**Step 3: Extend `runManualAgentSleep` input**

In `server/api/agent/sleep.post.ts`, add optional dependencies:

```ts
agent?: {
  id: string
}
tasks?: {
  addTask: (record: AgentTaskRecord) => void
  updateTask: (id: string, updates: Partial<Pick<AgentTaskRecord, 'status' | 'resultJson' | 'error' | 'updatedAt'>>) => void
}
events?: {
  addEvent: (record: AgentEventRecord) => void
}
```

Use them only when provided, so old tests can be migrated gradually.

**Step 4: Write task lifecycle**

At the start of sleep:

- Create `taskId`.
- Add `running` task.
- Add `task.started` event.

On success:

- Update task to `completed`.
- Write parsed result JSON.
- Add `task.completed` event.

On failure:

- Update task to `failed`.
- Add `task.failed` event.

**Step 5: Wire route dependencies**

In the default route handler:

- Resolve current Agent with `createAgentInstanceRepository`.
- Pass `createAgentTaskRepository`.
- Pass `createAgentEventRepository`.

**Step 6: Run tests**

Run:

```bash
npm run test -- server/api/agent.sleep.test.ts server/api/agent.os.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add server/api/agent/sleep.post.ts server/api/agent.sleep.test.ts server/api/agent.os.test.ts
git commit -m "feat: record sleep runs as agent os tasks"
```

---

### Task 6: Add Approval Inbox Actions

**Files:**

- Create: `server/api/agents/current/inbox/[id]/approve.post.ts`
- Create: `server/api/agents/current/inbox/[id]/reject.post.ts`
- Test: `server/api/agent.os.test.ts`

**Step 1: Write failing tests**

Add tests for helper functions:

- Approving `proposal:<id>` delegates to proposal accept.
- Rejecting `proposal:<id>` delegates to proposal reject.
- Approving `work_visibility:<id>` updates work visibility to `public`.
- Every action writes an Agent event.

Example:

```ts
expect(approveAgentInboxItem({
  itemId: 'work_visibility:work_1',
  keyId: 'key_1',
  agentId: 'agent_1',
  now: '2026-05-18T00:00:00.000Z',
  works,
  proposals,
  events,
})).toEqual({ id: 'work_1', type: 'work_visibility', status: 'approved' })
```

**Step 2: Run test to verify failure**

Run:

```bash
npm run test -- server/api/agent.os.test.ts
```

Expected: FAIL because helpers do not exist.

**Step 3: Implement approve helper**

Supported IDs:

- `proposal:<proposalId>`
- `work_visibility:<workId>`

For proposal:

- Reuse `applyAgentProposalAction`.
- Write `approval.approved` event.

For work:

- Reuse `updateAgentWorkVisibilityAction` logic or repository directly.
- Write `approval.approved` event.

**Step 4: Implement reject helper**

For proposal:

- Apply reject.
- Write `approval.rejected` event.

For work visibility:

- No-op on work visibility.
- Write `approval.rejected` event.

**Step 5: Add routes**

Routes:

- `POST /api/agents/current/inbox/:id/approve`
- `POST /api/agents/current/inbox/:id/reject`

Route must:

- Require key.
- Resolve current Agent.
- Call helper.

**Step 6: Run tests**

Run:

```bash
npm run test -- server/api/agent.os.test.ts server/api/agent.core.test.ts server/api/agent.works.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add server/api/agents/current/inbox/[id]/approve.post.ts server/api/agents/current/inbox/[id]/reject.post.ts server/api/agent.os.test.ts
git commit -m "feat: add agent os inbox actions"
```

---

### Task 7: Add Frontend Agent OS Composable

**Files:**

- Create: `composables/useAgentOs.ts`
- Test: `components/AgentCorePanel.test.ts`

**Step 1: Add component-facing type expectations**

Update `components/AgentCorePanel.test.ts` later in Task 8, but first create composable types:

```ts
export type AgentOsState = {
  agent: {
    id: string
    status: string
    ownerType: string
    ownerId: string
    domain: string
  }
  inbox: AgentOsInboxItem[]
  tasks: AgentOsTaskItem[]
  events: AgentOsEventItem[]
}
```

**Step 2: Implement composable**

Create `composables/useAgentOs.ts`:

```ts
import { readonly, ref } from 'vue'

export type AgentOsInboxItem = {
  id: string
  type: 'proposal' | 'work_visibility'
  title: string
  summary: string
  action: 'approve' | 'publish'
  createdAt: string
}

export type AgentOsTaskItem = {
  id: string
  type: string
  status: string
  title: string
  summary: string
  result?: Record<string, unknown>
  error?: string | null
  createdAt: string
  updatedAt: string
}

export type AgentOsEventItem = {
  id: string
  type: string
  title: string
  summary: string
  targetType?: string | null
  targetId?: string | null
  createdAt: string
}
```

Functions:

- `loadOs()`
- `approveInboxItem(id)`
- `rejectInboxItem(id)`

Endpoints:

- `GET /api/agents/current/os`
- `POST /api/agents/current/inbox/:id/approve`
- `POST /api/agents/current/inbox/:id/reject`

**Step 3: Run type and test check**

Run:

```bash
npm run test -- components/AgentCorePanel.test.ts
```

Expected: PASS because no component uses it yet.

**Step 4: Commit**

```bash
git add composables/useAgentOs.ts
git commit -m "feat: add agent os composable"
```

---

### Task 8: Upgrade 星AI Into Agent OS Console

**Files:**

- Modify: `components/AgentCorePanel.vue`
- Modify: `components/AgentCorePanel.test.ts`
- Modify: `pages/chat.vue`
- Modify: `assets/css/main.css`

**Step 1: Write failing component test**

In `components/AgentCorePanel.test.ts`, add:

```ts
it('shows agent os inbox and task center when os state is provided', async () => {
  const approveInboxItem = vi.fn(async () => true)
  const wrapper = mount(AgentCorePanel, {
    props: {
      loadCore: async () => core,
      loadOs: async () => ({
        agent: { id: 'agent_1', status: 'active', ownerType: 'key', ownerId: 'key_1', domain: 'star' },
        inbox: [
          {
            id: 'proposal:p1',
            type: 'proposal',
            title: '更短',
            summary: '回复更短。',
            action: 'approve',
            createdAt: '2026-05-18T00:00:00.000Z',
          },
        ],
        tasks: [
          {
            id: 'task_1',
            type: 'sleep',
            status: 'completed',
            title: '睡眠整理',
            summary: '整理完成。',
            createdAt: '2026-05-18T00:00:00.000Z',
            updatedAt: '2026-05-18T00:01:00.000Z',
          },
        ],
        events: [],
      }),
      approveInboxItem,
      applyProposal: vi.fn(),
    },
  })

  await wrapper.get('button.agent-core-panel__trigger').trigger('click')
  await flushPromises()

  expect(wrapper.text()).toContain('决策收件箱')
  expect(wrapper.text()).toContain('任务中心')
  expect(wrapper.text()).toContain('睡眠整理')

  await wrapper.get('button[aria-label="批准待办"]').trigger('click')
  expect(approveInboxItem).toHaveBeenCalledWith('proposal:p1')
})
```

**Step 2: Run test to verify failure**

Run:

```bash
npm run test -- components/AgentCorePanel.test.ts
```

Expected: FAIL because props and UI do not exist.

**Step 3: Add props**

In `AgentCorePanel.vue`, add optional props:

```ts
loadOs?: () => Promise<AgentOsState | null>
approveInboxItem?: (id: string) => Promise<boolean>
rejectInboxItem?: (id: string) => Promise<boolean>
```

Add local state:

```ts
const loadedOs = ref<AgentOsState | null>(null)
const inboxItems = computed(() => loadedOs.value?.inbox ?? [])
const osTasks = computed(() => loadedOs.value?.tasks ?? [])
```

When opening the panel, load both core and OS state.

**Step 4: Add UI sections**

Add sections near the top:

- `决策收件箱`
- `任务中心`

Keep existing proposal UI for backward compatibility in this task.

Do not duplicate actions visually if inbox already contains proposal items. Prefer showing inbox first and existing proposal list below as "进化细节".

**Step 5: Wire page**

In `pages/chat.vue`:

```ts
const {
  os: agentOs,
  loadOs: loadAgentOs,
  approveInboxItem,
  rejectInboxItem,
} = useAgentOs()
```

Pass methods to `AgentCorePanel`.

**Step 6: Add CSS**

Add compact console sections in `assets/css/main.css`:

- `.agent-core-panel__inbox`
- `.agent-core-panel__tasks`
- `.agent-core-panel__task`

Keep panel width stable.

**Step 7: Run tests**

Run:

```bash
npm run test -- components/AgentCorePanel.test.ts
npm run test -- server/api/agent.os.test.ts
```

Expected: PASS.

**Step 8: Commit**

```bash
git add components/AgentCorePanel.vue components/AgentCorePanel.test.ts pages/chat.vue assets/css/main.css
git commit -m "feat: show agent os console"
```

---

### Task 9: Update E2E Product Flow

**Files:**

- Modify: `tests/e2e/main-flow.spec.ts`

**Step 1: Update route mocks**

In `tests/e2e/main-flow.spec.ts`, add route:

```ts
await page.route('**/api/agents/current/os', async (route) => {
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      agent: {
        id: 'agent_1',
        status: 'active',
        ownerType: 'key',
        ownerId: 'key_1',
        domain: 'star',
      },
      inbox: [
        {
          id: 'proposal:proposal_1',
          type: 'proposal',
          title: '调整页面',
          summary: '让页面更像星空。',
          action: 'approve',
          createdAt: '2026-05-17T00:00:00.000Z',
        },
      ],
      tasks: [
        {
          id: 'task_1',
          type: 'sleep',
          status: 'completed',
          title: '睡眠整理',
          summary: '整理完成。',
          createdAt: '2026-05-17T00:00:00.000Z',
          updatedAt: '2026-05-17T00:01:00.000Z',
        },
      ],
      events: [],
    }),
  })
})
```

Add approve/reject routes:

```ts
await page.route('**/api/agents/current/inbox/*/approve', async (route) => {
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ ok: true }),
  })
})
```

**Step 2: Update expectations**

In the flow:

- Open 星AI.
- Assert `决策收件箱`.
- Assert `任务中心`.
- Assert `睡眠整理`.
- Keep memory planet expectations focused on memory, timeline, works.
- Do not expect sleep button inside memory planet.

**Step 3: Run E2E**

Run:

```bash
npm run test:e2e
```

Expected: PASS.

**Step 4: Commit**

```bash
git add tests/e2e/main-flow.spec.ts
git commit -m "test: verify agent os console flow"
```

---

### Task 10: Full Verification

**Files:**

- Inspect only.

**Step 1: Run full tests**

Run:

```bash
npm run test
```

Expected: PASS.

**Step 2: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

**Step 3: Run e2e**

Run:

```bash
npm run test:e2e
```

Expected: PASS.

**Step 4: Inspect status**

Run:

```bash
git status --short
```

Expected: clean.

If generated test artifacts appear, do not commit them unless already tracked and intentionally updated.

---

## Post-Implementation Review Checklist

- `AgentCorePanel` is the Agent OS business console.
- `MemoryPlanetPanel` does not render Agent Core.
- Current key has a stable Agent binding.
- Sleep run creates an Agent task and event.
- Inbox aggregates proposals and private work publish candidates.
- Inbox actions write Agent events.
- New OS API does not leak private payload JSON.
- Existing `/api/agent/*` APIs still pass tests.
- Public stars API remains privacy-safe.
