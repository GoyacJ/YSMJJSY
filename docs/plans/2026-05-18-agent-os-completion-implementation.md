# Agent OS Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish the incomplete Agent OS design so the current key-based 星AI product has a real reusable Agent runtime boundary, not only business APIs with Agent-flavored names.

**Architecture:** Keep the existing key-scoped product stable. Add missing Agent OS/Kernel seams as compatibility layers over current SQLite tables, then route sleep, approval, provider, and tool execution through those seams. Do not physically migrate every `key_id` table to `agent_id` in this phase; use `agent_bindings` as the owner bridge.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Nitro server routes, better-sqlite3, MiniMax, Zod, Vitest, Vue Test Utils, Playwright.

---

## Audit Baseline

Date: 2026-05-18

Commands already verified:

```bash
git status --short
npm run test
```

Observed baseline:

- Worktree is clean.
- Unit tests pass: 48 files / 260 tests.
- Existing Agent OS endpoints are only:
  - `GET /api/agents/current/os`
  - `POST /api/agents/current/inbox/:id/approve`
  - `POST /api/agents/current/inbox/:id/reject`
- Existing business Agent endpoints are:
  - `GET /api/agent/core`
  - `POST /api/agent/sleep`
  - `PUT /api/agent/proposals/:id`
  - `POST /api/agent/design-proposals/:id`
  - `PUT /api/agent/memories/:id`
  - `GET /api/agent/timeline`
  - `GET /api/agent/works`
  - `PUT /api/agent/works/:id`

## Current Incomplete Content

These gaps come from comparing `docs/plans/2026-05-18-agent-os-layered-architecture-design.md` against current code.

### Completed Enough

- Key to Agent binding exists through `agent_instances` and `agent_bindings`.
- Agent tasks and events tables exist.
- Sleep runs create task/events when Agent OS repos are provided.
- Agent OS response aggregates agent, inbox, tasks, events.
- Inbox can approve/reject proposals and approve/reject work publishing.
- `AgentModelProvider` and `AgentToolRegistry` exist as typed seams.
- Agent Core UI displays inbox and task center.
- Memory planet no longer owns the Agent console.
- Public universe exposes only safe public fields.

### Not Complete

- No `AgentObservation` model/table/repository.
- No `AgentLoop`.
- No `AgentTaskQueue` or task runner.
- No `AgentPolicyEngine`.
- No `AgentProviderRegistry`.
- `AgentToolRegistry` is not used by product code.
- `AgentModelProvider` is not used by product code.
- MiniMax clients are still created directly in API routes.
- `/api/agents/current`, `/api/agents/current/tasks`, `/api/agents/current/inbox`, and `/api/agents/current/events` are missing.
- Inbox only covers proposals and work publishing. It does not cover memory governance suggestions, waiting-approval tasks, rollback, or tool approvals.
- Sleep `memoryActions` are displayed as a report only. They do not become actionable inbox items.
- Provider, tool, policy, and secondary learning failures are not consistently written to `agent_events`.
- Task/event types are ad hoc strings, not centralized.
- Agent Core does not show event/audit history or policy boundary.
- Business APIs still contain Agent runtime behavior directly.

## Scope

This plan completes the current Agent OS design in the same app process.

In scope:

- Observation store.
- Provider registry.
- Tool registry wired to star domain tools.
- Fixed default policy engine.
- Synchronous task queue/runner.
- Missing OS APIs.
- Expanded inbox.
- Error/audit event normalization.
- UI and E2E updates.

Out of scope:

- Background worker.
- True cron scheduler.
- Multi-Agent collaboration.
- Third-party provider settings UI.
- Full physical migration from `key_id` to `agent_id`.
- Browser automation tools.
- External deployment changes.

## Execution Rules

- Use TDD for every behavior change.
- Keep existing `/api/agent/*` endpoints compatible.
- Prefer service helpers over route-only logic.
- Do not expose raw `payloadJson`, full conversation text, key hash, IP hash, session token, provider raw body, or private work payload through public or OS list APIs.
- After each task, run the focused tests listed.
- After any UI task, run related component tests and `npm run test:e2e`.
- Commit after each task when executing this plan in a clean branch.

---

### Task 0: Verify Baseline And Freeze Assumptions

**Files:**

- Inspect only.

**Step 1: Check worktree**

Run:

```bash
git status --short
```

Expected: clean.

**Step 2: Run full unit baseline**

Run:

```bash
npm run test
```

Expected: PASS.

**Step 3: Run build baseline**

Run:

```bash
npm run build
```

Expected: PASS. Existing sourcemap warnings are acceptable.

**Step 4: Run E2E baseline**

Run:

```bash
npm run test:e2e
```

Expected: PASS.

**Step 5: Commit**

No commit if no files changed.

---

### Task 1: Add Agent Domain Types And Observation Store

**Why:** The design defines `AgentObservation`, but current code writes chat, design, media, and approval events directly to business tables. The Agent Kernel has no normalized input stream.

**Files:**

- Create: `server/services/agent-domain.ts`
- Modify: `server/db/schema.ts`
- Modify: `server/db/sqlite.ts`
- Modify: `server/db/sqlite.test.ts`

**Step 1: Create failing domain type test**

In `server/db/sqlite.test.ts`, add:

```ts
it('stores agent observations by agent id', () => {
  const repo = createAgentObservationRepository(':memory:')
  repo.addObservation({
    id: 'observation_1',
    agentId: 'agent_1',
    sourceType: 'chat',
    sourceId: 'conversation_1',
    summary: '用户发送了一条消息。',
    payloadJson: '{"private":true}',
    createdAt: '2026-05-18T00:00:00.000Z',
  })

  expect(repo.listObservationsByAgent('agent_1')).toEqual([
    {
      id: 'observation_1',
      agentId: 'agent_1',
      sourceType: 'chat',
      sourceId: 'conversation_1',
      summary: '用户发送了一条消息。',
      payloadJson: '{"private":true}',
      createdAt: '2026-05-18T00:00:00.000Z',
    },
  ])
})
```

**Step 2: Run failure**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected: FAIL because `createAgentObservationRepository` does not exist.

**Step 3: Add centralized domain types**

Create `server/services/agent-domain.ts`:

```ts
export type AgentObservationSourceType = 'chat' | 'media' | 'design' | 'approval' | 'memory' | 'system'

export type AgentEventType =
  | 'observation.created'
  | 'task.queued'
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'task.cancelled'
  | 'approval.required'
  | 'approval.approved'
  | 'approval.rejected'
  | 'tool.started'
  | 'tool.completed'
  | 'tool.failed'
  | 'provider.failed'
  | 'policy.denied'

export type AgentInboxItemType =
  | 'proposal'
  | 'work_visibility'
  | 'memory_governance'
  | 'task_approval'
  | 'rollback'
```

**Step 4: Add schema**

In `server/db/schema.ts`, add:

```sql
CREATE TABLE IF NOT EXISTS agent_observations (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  summary TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
)
```

**Step 5: Add repository**

In `server/db/sqlite.ts`, add:

```ts
export type AgentObservationRecord = {
  id: string
  agentId: string
  sourceType: AgentObservationSourceType
  sourceId?: string | null
  summary: string
  payloadJson: string
  createdAt: string
}
```

Add `createAgentObservationRepository(path)` with:

- `addObservation(record)`
- `listObservationsByAgent(agentId, limit = 40)`

Order observations by `created_at DESC`.

**Step 6: Run tests**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add server/services/agent-domain.ts server/db/schema.ts server/db/sqlite.ts server/db/sqlite.test.ts
git commit -m "feat: add agent observations"
```

---

### Task 2: Normalize Agent Event Creation And Safe Serialization

**Why:** Events exist, but event types and payload safety are spread across routes.

**Files:**

- Create: `server/services/agent-events.ts`
- Create: `server/services/agent-events.test.ts`
- Modify: `server/services/agent-os.ts`
- Modify: `server/services/agent-os.test.ts`
- Modify: `server/api/agent.os.test.ts`

**Step 1: Write failing event helper tests**

Create `server/services/agent-events.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildAgentEvent, serializeAgentEventForOs } from './agent-events'

describe('agent event helpers', () => {
  it('builds typed private events', () => {
    expect(buildAgentEvent({
      id: 'event_1',
      agentId: 'agent_1',
      type: 'tool.failed',
      title: '工具失败',
      summary: '生成图片失败。',
      targetType: 'tool',
      targetId: 'star.generateImage',
      payload: { providerBody: 'hidden' },
      createdAt: '2026-05-18T00:00:00.000Z',
    })).toMatchObject({
      type: 'tool.failed',
      payloadJson: '{"providerBody":"hidden"}',
      visibility: 'private',
    })
  })

  it('does not serialize payload json into os event lists', () => {
    const event = buildAgentEvent({
      id: 'event_1',
      agentId: 'agent_1',
      type: 'provider.failed',
      title: 'Provider failed',
      summary: '模型失败。',
      payload: { raw: 'secret' },
      createdAt: '2026-05-18T00:00:00.000Z',
    })

    expect(JSON.stringify(serializeAgentEventForOs(event))).not.toContain('secret')
  })
})
```

**Step 2: Run failure**

Run:

```bash
npm run test -- server/services/agent-events.test.ts
```

Expected: FAIL because helper file does not exist.

**Step 3: Implement helpers**

`buildAgentEvent` should accept typed input and return `AgentEventRecord`.

`serializeAgentEventForOs` should return:

```ts
{
  id,
  type,
  title,
  summary,
  targetType,
  targetId,
  createdAt,
}
```

Never return `payloadJson`.

**Step 4: Use helper in `agent-os.ts`**

Replace inline event serialization in `buildAgentOsResponse` with `serializeAgentEventForOs`.

**Step 5: Use helper in inbox actions**

In `server/api/agents/current/inbox/[id]/approve.post.ts`, replace manual event object creation with `buildAgentEvent`.

**Step 6: Run tests**

Run:

```bash
npm run test -- server/services/agent-events.test.ts server/services/agent-os.test.ts server/api/agent.os.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add server/services/agent-events.ts server/services/agent-events.test.ts server/services/agent-os.ts server/services/agent-os.test.ts server/api/agents/current/inbox/[id]/approve.post.ts server/api/agent.os.test.ts
git commit -m "feat: normalize agent events"
```

---

### Task 3: Complete Provider Registry And Stop Direct MiniMax Construction In Agent Paths

**Why:** `AgentModelProvider` exists but product code does not use it. MiniMax is still constructed directly in Agent and design routes.

**Files:**

- Modify: `server/services/agent-runtime.ts`
- Modify: `server/services/agent-runtime.test.ts`
- Create: `server/services/agent-providers.ts`
- Create: `server/services/agent-providers.test.ts`
- Modify: `server/api/chat/stream.post.ts`
- Modify: `server/api/agent/sleep.post.ts`
- Modify: `server/api/agent/design-proposals/[id].post.ts`
- Modify: `server/api/design/preview.post.ts`
- Test: `server/api/chat.post.test.ts`
- Test: `server/api/agent.sleep.test.ts`
- Test: `server/api/design.test.ts`

**Step 1: Write failing provider registry test**

In `server/services/agent-runtime.test.ts`, add:

```ts
import { createAgentProviderRegistry } from './agent-runtime'

it('registers and resolves model providers by name', () => {
  const registry = createAgentProviderRegistry()
  const provider = {
    name: 'fake',
    chat: vi.fn(),
    reflect: vi.fn(),
    generateDesignPatch: vi.fn(),
  }

  registry.register(provider)

  expect(registry.get('fake')).toBe(provider)
  expect(registry.getDefault()).toBe(provider)
})
```

Expected: FAIL.

**Step 2: Extend runtime types**

In `server/services/agent-runtime.ts`, add:

```ts
export type NamedAgentModelProvider = AgentModelProvider & {
  name: string
}

export type AgentProviderRegistry = {
  register: (provider: NamedAgentModelProvider) => void
  get: (name: string) => NamedAgentModelProvider | undefined
  getDefault: () => NamedAgentModelProvider
}
```

Add `createAgentProviderRegistry`.

**Step 3: Add config factory**

Create `server/services/agent-providers.ts`:

```ts
import { createMiniMaxClient } from './minimax'
import { createMiniMaxAgentModelProvider } from './agent-runtime'

export function createDefaultAgentModelProvider(config: {
  minimaxApiKey: string
  minimaxGroupId?: string
}) {
  return {
    name: 'minimax',
    ...createMiniMaxAgentModelProvider(createMiniMaxClient({
      apiKey: config.minimaxApiKey,
      groupId: config.minimaxGroupId,
    })),
  }
}
```

**Step 4: Migrate Agent model call sites**

Replace direct `createMiniMaxClient` usage with `createDefaultAgentModelProvider` in:

- `server/api/chat/stream.post.ts`
- `server/api/agent/sleep.post.ts`
- `server/api/agent/design-proposals/[id].post.ts`
- `server/api/design/preview.post.ts`

Keep media-specific routes unchanged in this task.

For `chat/stream.post.ts`, keep MiniMax media client for `streamStarChatReply` if needed, but use model provider for `runAgentLearning`.

**Step 5: Run tests**

Run:

```bash
npm run test -- server/services/agent-runtime.test.ts server/services/agent-providers.test.ts server/api/chat.post.test.ts server/api/agent.sleep.test.ts server/api/design.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/services/agent-runtime.ts server/services/agent-runtime.test.ts server/services/agent-providers.ts server/services/agent-providers.test.ts server/api/chat/stream.post.ts server/api/agent/sleep.post.ts server/api/agent/design-proposals/[id].post.ts server/api/design/preview.post.ts server/api/chat.post.test.ts server/api/agent.sleep.test.ts server/api/design.test.ts
git commit -m "feat: use agent provider registry"
```

---

### Task 4: Register Star Domain Tools

**Why:** Tool registry exists but no business capability is registered as a tool.

**Files:**

- Create: `server/services/star-agent-tools.ts`
- Create: `server/services/star-agent-tools.test.ts`
- Modify: `server/services/agent-runtime.ts`
- Modify: `server/services/agent-runtime.test.ts`

**Step 1: Write failing tool registration test**

Create `server/services/star-agent-tools.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createAgentToolRegistry } from './agent-runtime'
import { registerStarAgentTools } from './star-agent-tools'

describe('star agent tools', () => {
  it('registers star domain tools with risk metadata', () => {
    const registry = createAgentToolRegistry()

    registerStarAgentTools(registry, {} as any)

    expect(registry.list().map(tool => tool.name)).toEqual(expect.arrayContaining([
      'star.previewDesign',
      'star.publishWork',
      'star.governMemory',
      'star.generateImage',
      'star.generateMusic',
      'star.generateVideo',
    ]))
    expect(registry.get('star.publishWork')?.approvalRequired).toBe(true)
  })

  it('executes publish work through injected repositories', async () => {
    const registry = createAgentToolRegistry()
    const updateWorkVisibility = vi.fn()

    registerStarAgentTools(registry, {
      keyId: 'key_1',
      now: '2026-05-18T00:00:00.000Z',
      works: {
        getWorkByKey: () => ({ id: 'work_1', visibility: 'private' }),
        updateWorkVisibility,
      },
    } as any)

    await registry.execute('star.publishWork', { workId: 'work_1' })

    expect(updateWorkVisibility).toHaveBeenCalledWith('key_1', 'work_1', 'public', '2026-05-18T00:00:00.000Z')
  })
})
```

**Step 2: Run failure**

Run:

```bash
npm run test -- server/services/star-agent-tools.test.ts
```

Expected: FAIL.

**Step 3: Implement registry function**

Create `registerStarAgentTools(registry, context)`.

Register:

- `star.previewDesign`: high risk, approval required.
- `star.commitDesign`: high risk, approval required.
- `star.publishWork`: high risk, approval required.
- `star.governMemory`: medium risk, approval required.
- `star.generateImage`: medium risk, approval not required.
- `star.generateMusic`: medium risk, approval not required.
- `star.generateVideo`: medium risk, approval not required.

Keep inputs as `unknown`; validate inside each tool with small type guards.

**Step 4: Run tests**

Run:

```bash
npm run test -- server/services/star-agent-tools.test.ts server/services/agent-runtime.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add server/services/star-agent-tools.ts server/services/star-agent-tools.test.ts server/services/agent-runtime.ts server/services/agent-runtime.test.ts
git commit -m "feat: register star agent tools"
```

---

### Task 5: Add Fixed Agent Policy Engine

**Why:** The design requires policy decisions before high-risk actions. Current code relies on route-specific conditionals.

**Files:**

- Create: `server/services/agent-policy.ts`
- Create: `server/services/agent-policy.test.ts`
- Modify: `server/services/agent-runtime.ts`

**Step 1: Write failing policy tests**

Create `server/services/agent-policy.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { defaultAgentPolicy, evaluateAgentToolPolicy } from './agent-policy'

describe('agent policy', () => {
  it('allows low risk tools without approval', () => {
    expect(evaluateAgentToolPolicy(defaultAgentPolicy, {
      name: 'star.readContext',
      riskLevel: 'low',
      approvalRequired: false,
    })).toEqual({ allowed: true, approvalRequired: false })
  })

  it('requires approval for publishing', () => {
    expect(evaluateAgentToolPolicy(defaultAgentPolicy, {
      name: 'star.publishWork',
      riskLevel: 'high',
      approvalRequired: true,
    })).toEqual({ allowed: true, approvalRequired: true })
  })
})
```

**Step 2: Run failure**

Run:

```bash
npm run test -- server/services/agent-policy.test.ts
```

Expected: FAIL.

**Step 3: Implement policy**

Use fixed default policy:

```ts
export type AgentPolicy = {
  autoLearn: boolean
  autoReflect: boolean
  autoRunLowRiskTasks: boolean
  requireApprovalForPersonaChange: boolean
  requireApprovalForDesignChange: boolean
  requireApprovalForPublishing: boolean
  requireApprovalForMemoryRejection: boolean
}
```

No policy editor. No DB table in this task.

**Step 4: Run tests**

Run:

```bash
npm run test -- server/services/agent-policy.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add server/services/agent-policy.ts server/services/agent-policy.test.ts server/services/agent-runtime.ts
git commit -m "feat: add agent policy engine"
```

---

### Task 6: Add Synchronous Agent Task Queue And Runner

**Why:** `agent_tasks` is currently storage only. There is no queue abstraction, no runner, and no generic task lifecycle.

**Files:**

- Create: `server/services/agent-task-queue.ts`
- Create: `server/services/agent-task-queue.test.ts`
- Modify: `server/api/agent/sleep.post.ts`
- Modify: `server/api/agent.sleep.test.ts`

**Step 1: Write failing task queue tests**

Create `server/services/agent-task-queue.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { enqueueAgentTask, runAgentTask } from './agent-task-queue'

describe('agent task queue', () => {
  it('enqueues tasks and writes task queued event', () => {
    const tasks = { addTask: vi.fn() }
    const events = { addEvent: vi.fn() }

    const task = enqueueAgentTask({
      agentId: 'agent_1',
      type: 'sleep',
      title: '睡眠整理',
      summary: '整理最近记忆。',
      input: { keyId: 'key_1' },
      now: '2026-05-18T00:00:00.000Z',
      tasks,
      events,
    } as any)

    expect(task.status).toBe('queued')
    expect(tasks.addTask).toHaveBeenCalledWith(expect.objectContaining({ status: 'queued' }))
    expect(events.addEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'task.queued' }))
  })

  it('runs a queued tool task to completion', async () => {
    const updateTask = vi.fn()
    const addEvent = vi.fn()
    const registry = {
      get: () => ({
        name: 'star.generateImage',
        description: 'Generate image',
        riskLevel: 'medium',
        approvalRequired: false,
        execute: vi.fn(async () => ({ ok: true, output: { url: 'u' } })),
      }),
      execute: vi.fn(async () => ({ ok: true, output: { url: 'u' } })),
    }

    await runAgentTask({
      task: {
        id: 'task_1',
        agentId: 'agent_1',
        type: 'generate_artifact',
        status: 'queued',
        title: '生成图片',
        summary: '生成图片。',
        inputJson: '{"toolName":"star.generateImage","input":{"prompt":"star"}}',
        createdAt: '2026-05-18T00:00:00.000Z',
        updatedAt: '2026-05-18T00:00:00.000Z',
      },
      now: '2026-05-18T00:01:00.000Z',
      tasks: { updateTask },
      events: { addEvent },
      registry,
      policy: { autoRunLowRiskTasks: true } as any,
    } as any)

    expect(updateTask).toHaveBeenCalledWith('task_1', expect.objectContaining({ status: 'completed' }))
    expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'task.completed' }))
  })
})
```

**Step 2: Run failure**

Run:

```bash
npm run test -- server/services/agent-task-queue.test.ts
```

Expected: FAIL.

**Step 3: Implement queue**

Implement:

- `enqueueAgentTask(input)`
- `runAgentTask(input)`
- `cancelAgentTask(input)`
- `parseTaskInputJson(value)`

Runner rules:

- `queued -> running -> completed`
- tool failure: `failed`
- policy denied: `failed` with `policy.denied` event
- approval required: `waiting_approval` with `approval.required` event

Do not add background worker.

**Step 4: Move sleep task lifecycle into queue helper**

Keep `runManualAgentSleep` API response unchanged.

Inside `runManualAgentSleep`, use task queue helper for:

- task creation
- `task.started`
- `task.completed`
- `task.failed`

**Step 5: Run tests**

Run:

```bash
npm run test -- server/services/agent-task-queue.test.ts server/api/agent.sleep.test.ts server/api/agent.os.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/services/agent-task-queue.ts server/services/agent-task-queue.test.ts server/api/agent/sleep.post.ts server/api/agent.sleep.test.ts
git commit -m "feat: add agent task runner"
```

---

### Task 7: Complete Agent OS API Surface

**Why:** The design lists OS APIs that are still missing.

**Files:**

- Create: `server/api/agents/current.get.ts`
- Create: `server/api/agents/current/tasks.get.ts`
- Create: `server/api/agents/current/tasks.post.ts`
- Create: `server/api/agents/current/tasks/[id].put.ts`
- Create: `server/api/agents/current/inbox.get.ts`
- Create: `server/api/agents/current/events.get.ts`
- Modify: `server/api/agents/current/os.get.ts`
- Modify: `server/api/agent.os.test.ts`
- Modify: `composables/useAgentOs.ts`

**Step 1: Write failing OS API helper tests**

In `server/api/agent.os.test.ts`, add helper tests for:

- current agent metadata
- task list
- task enqueue
- task cancel
- standalone inbox list
- standalone event list

Example:

```ts
it('builds safe agent event list responses without payload json', () => {
  const result = buildAgentEventsResponse({
    events: {
      listEventsByAgent: () => [{
        id: 'event_1',
        agentId: 'agent_1',
        type: 'provider.failed',
        title: 'Provider failed',
        summary: '模型失败。',
        payloadJson: '{"raw":"secret"}',
        visibility: 'private',
        createdAt: '2026-05-18T00:00:00.000Z',
      }],
    },
    agentId: 'agent_1',
  })

  expect(JSON.stringify(result)).not.toContain('secret')
})
```

**Step 2: Run failure**

Run:

```bash
npm run test -- server/api/agent.os.test.ts
```

Expected: FAIL until helpers/endpoints exist.

**Step 3: Add endpoints**

Implement:

- `GET /api/agents/current`: returns `{ agent }`.
- `GET /api/agents/current/tasks`: returns `{ tasks }`.
- `POST /api/agents/current/tasks`: accepts `{ type, input }`, enqueues supported tasks.
- `PUT /api/agents/current/tasks/:id`: supports `{ action: 'cancel' | 'run' }`.
- `GET /api/agents/current/inbox`: returns `{ inbox }`.
- `GET /api/agents/current/events`: returns `{ events }`.

Supported `POST /tasks` MVP types:

- `sleep`
- `generate_artifact`
- `preview_design`
- `publish_artifact`
- `govern_memory`

**Step 4: Update `useAgentOs`**

Add:

- `loadTasks`
- `enqueueTask`
- `runTask`
- `cancelTask`
- `loadInbox`
- `loadEvents`

Keep existing `loadOs`, `approveInboxItem`, `rejectInboxItem`.

**Step 5: Run tests**

Run:

```bash
npm run test -- server/api/agent.os.test.ts
npm run test -- components/AgentCorePanel.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/api/agents/current.get.ts server/api/agents/current/tasks.get.ts server/api/agents/current/tasks.post.ts server/api/agents/current/tasks/[id].put.ts server/api/agents/current/inbox.get.ts server/api/agents/current/events.get.ts server/api/agents/current/os.get.ts server/api/agent.os.test.ts composables/useAgentOs.ts
git commit -m "feat: complete agent os api surface"
```

---

### Task 8: Expand Inbox To Memory Governance And Waiting Approval Tasks

**Why:** Inbox currently covers only proposals and work publishing. The design requires high-risk actions to enter inbox.

**Files:**

- Modify: `server/services/agent-os.ts`
- Modify: `server/services/agent-os.test.ts`
- Modify: `server/api/agents/current/inbox/[id]/approve.post.ts`
- Modify: `server/api/agents/current/inbox/[id]/reject.post.ts`
- Modify: `server/api/agent.os.test.ts`
- Modify: `composables/useAgentOs.ts`
- Modify: `components/AgentCorePanel.vue`
- Modify: `components/AgentCorePanel.test.ts`

**Step 1: Write failing inbox aggregation tests**

In `server/services/agent-os.test.ts`, add:

```ts
it('builds inbox items from sleep memory actions and waiting approval tasks', () => {
  const result = buildAgentInbox({
    pendingProposals: [],
    publicWorkCandidates: [],
    memoryActionCandidates: [
      { memoryId: 'm1', action: 'archive', reason: '过期。', createdAt: '2026-05-18T00:00:00.000Z' },
    ],
    waitingApprovalTasks: [
      {
        id: 'task_1',
        type: 'publish_artifact',
        status: 'waiting_approval',
        title: '公开作品',
        summary: '公开月光图。',
        createdAt: '2026-05-18T00:00:00.000Z',
      },
    ],
  } as any)

  expect(result.map(item => item.id)).toEqual([
    'memory_governance:m1:archive',
    'task_approval:task_1',
  ])
})
```

**Step 2: Run failure**

Run:

```bash
npm run test -- server/services/agent-os.test.ts
```

Expected: FAIL.

**Step 3: Extend inbox item type**

Support:

- `proposal:<proposalId>`
- `work_visibility:<workId>`
- `memory_governance:<memoryId>:<action>`
- `task_approval:<taskId>`
- `rollback:<snapshotId>`

Each item should include:

- `id`
- `type`
- `title`
- `summary`
- `action`
- `createdAt`

Do not include raw payload.

**Step 4: Map sleep memory actions**

Use latest completed sleep run `memoryActionsJson` to generate memory governance inbox candidates.

Deduplicate:

- same memory id
- same action
- same latest sleep run

**Step 5: Approve/reject behavior**

Approve:

- proposal: existing behavior.
- work visibility: existing behavior.
- memory governance: call `applyMemoryGovernanceAction`.
- task approval: run or complete task through task queue depending on task type.
- rollback: call restore snapshot action.

Reject:

- proposal: existing behavior.
- work visibility: write rejection event only.
- memory governance: write rejection event only.
- task approval: mark task cancelled.
- rollback: write rejection event only.

**Step 6: Update UI**

In `AgentCorePanel.vue`, render labels by `item.type`.

Examples:

- `memory_governance`: button text `执行`
- `task_approval`: button text `批准`
- `rollback`: button text `回滚`
- `work_visibility`: button text `公开`

**Step 7: Run tests**

Run:

```bash
npm run test -- server/services/agent-os.test.ts server/api/agent.os.test.ts components/AgentCorePanel.test.ts
```

Expected: PASS.

**Step 8: Commit**

```bash
git add server/services/agent-os.ts server/services/agent-os.test.ts server/api/agents/current/inbox/[id]/approve.post.ts server/api/agents/current/inbox/[id]/reject.post.ts server/api/agent.os.test.ts composables/useAgentOs.ts components/AgentCorePanel.vue components/AgentCorePanel.test.ts
git commit -m "feat: expand agent inbox actions"
```

---

### Task 9: Write Observations And Audit Events From Business Flows

**Why:** The Agent runtime needs a real input stream. Current code writes business records but does not create observations.

**Files:**

- Modify: `server/api/chat/stream.post.ts`
- Modify: `server/api/design/commit.post.ts`
- Modify: `server/api/video/tasks.post.ts`
- Modify: `server/api/video/tasks/[id].get.ts`
- Modify: `server/api/agent/proposals/[id].put.ts`
- Modify: `server/api/agent/memories/[id].put.ts`
- Modify: `server/api/agents/current/inbox/[id]/approve.post.ts`
- Test: `server/api/chat.post.test.ts`
- Test: `server/api/design.test.ts`
- Test: `server/api/media.test.ts`
- Test: `server/api/agent.core.test.ts`
- Test: `server/api/agent.memory.test.ts`
- Test: `server/api/agent.os.test.ts`

**Step 1: Write failing chat observation test**

In `server/api/chat.post.test.ts`, add a helper-level test around a new exported helper:

```ts
it('records chat observations for user and assistant messages', () => {
  const addObservation = vi.fn()
  const addEvent = vi.fn()

  recordChatObservations({
    agentId: 'agent_1',
    userConversationId: 'user_1',
    assistantConversationId: 'assistant_1',
    userSummary: '用户发送消息。',
    assistantSummary: '助手完成回复。',
    now: '2026-05-18T00:00:00.000Z',
    observations: { addObservation },
    events: { addEvent },
  })

  expect(addObservation).toHaveBeenCalledTimes(2)
  expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'observation.created' }))
})
```

**Step 2: Run failure**

Run:

```bash
npm run test -- server/api/chat.post.test.ts
```

Expected: FAIL.

**Step 3: Add observation helpers**

Add small exported helpers near each business flow:

- `recordChatObservations`
- `recordDesignObservation`
- `recordMediaObservation`
- `recordApprovalObservation`
- `recordMemoryGovernanceObservation`

Each helper writes:

- `agent_observations`
- `agent_events` with `observation.created`

Payloads can contain IDs and short structured metadata only.

**Step 4: Write failure audit events**

When these fail, write `agent_events`:

- provider failure: `provider.failed`
- tool failure: `tool.failed`
- policy denial: `policy.denied`
- learning reflection failure: `task.failed` or `provider.failed`

Do not replace user-facing response text with raw error details.

**Step 5: Run tests**

Run:

```bash
npm run test -- server/api/chat.post.test.ts server/api/design.test.ts server/api/media.test.ts server/api/agent.core.test.ts server/api/agent.memory.test.ts server/api/agent.os.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/api/chat/stream.post.ts server/api/design/commit.post.ts server/api/video/tasks.post.ts server/api/video/tasks/[id].get.ts server/api/agent/proposals/[id].put.ts server/api/agent/memories/[id].put.ts server/api/agents/current/inbox/[id]/approve.post.ts server/api/chat.post.test.ts server/api/design.test.ts server/api/media.test.ts server/api/agent.core.test.ts server/api/agent.memory.test.ts server/api/agent.os.test.ts
git commit -m "feat: record agent observations"
```

---

### Task 10: Route Business Actions Through Tools Where Safe

**Why:** Business APIs still execute Agent actions directly. Keep compatibility, but use runtime tools underneath.

**Files:**

- Modify: `server/api/agent/design-proposals/[id].post.ts`
- Modify: `server/api/agent/works/[id].put.ts`
- Modify: `server/api/agent/memories/[id].put.ts`
- Modify: `server/api/image.post.ts`
- Modify: `server/api/music.post.ts`
- Modify: `server/api/video/tasks.post.ts`
- Modify: `server/api/agent.os.test.ts`
- Modify: `server/api/agent.works.test.ts`
- Modify: `server/api/agent.memory.test.ts`
- Modify: `server/api/media.test.ts`

**Step 1: Write failing delegation tests**

In relevant API tests, assert actions can be executed through injected tool registry:

```ts
it('publishes works through star.publishWork tool', async () => {
  const execute = vi.fn(async () => ({ ok: true, output: { id: 'work_1', visibility: 'public' } }))

  const result = await publishWorkWithTool({
    toolName: 'star.publishWork',
    workId: 'work_1',
    registry: { execute },
  } as any)

  expect(result.visibility).toBe('public')
  expect(execute).toHaveBeenCalledWith('star.publishWork', { workId: 'work_1' })
})
```

**Step 2: Run failure**

Run:

```bash
npm run test -- server/api/agent.works.test.ts server/api/agent.memory.test.ts server/api/media.test.ts
```

Expected: FAIL.

**Step 3: Add thin route helpers**

For each existing API, keep the public contract unchanged.

Internally call:

- `star.previewDesign`
- `star.publishWork`
- `star.governMemory`
- `star.generateImage`
- `star.generateMusic`
- `star.generateVideo`

If policy says approval required and the route is a direct user action, allow it because the user explicitly invoked the route.

If policy says approval required and the action comes from task runner, set `waiting_approval`.

**Step 4: Run tests**

Run:

```bash
npm run test -- server/api/agent.os.test.ts server/api/agent.works.test.ts server/api/agent.memory.test.ts server/api/media.test.ts server/api/design.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add server/api/agent/design-proposals/[id].post.ts server/api/agent/works/[id].put.ts server/api/agent/memories/[id].put.ts server/api/image.post.ts server/api/music.post.ts server/api/video/tasks.post.ts server/api/agent.os.test.ts server/api/agent.works.test.ts server/api/agent.memory.test.ts server/api/media.test.ts server/api/design.test.ts
git commit -m "feat: route agent actions through tools"
```

---

### Task 11: Upgrade Agent Core UI To A Real OS Console

**Why:** The UI shows inbox and tasks, but not full OS state, events, task actions, or policy boundaries.

**Files:**

- Modify: `composables/useAgentOs.ts`
- Modify: `components/AgentCorePanel.vue`
- Modify: `components/AgentCorePanel.test.ts`
- Modify: `pages/chat.vue`
- Modify: `assets/css/main.css`
- Modify: `tests/e2e/main-flow.spec.ts`

**Step 1: Write failing component tests**

In `components/AgentCorePanel.test.ts`, add tests for:

- event history rendering
- memory governance inbox item
- task waiting approval item
- task cancel/run buttons
- no raw payload display

Example:

```ts
it('shows agent events without raw payloads', async () => {
  const wrapper = mount(AgentCorePanel, {
    props: {
      loadCore: async () => core,
      loadOs: async () => ({
        agent: { id: 'agent_1', status: 'active', ownerType: 'key', ownerId: 'key_1', domain: 'star' },
        inbox: [],
        tasks: [],
        events: [{
          id: 'event_1',
          type: 'provider.failed',
          title: 'Provider failed',
          summary: '模型失败。',
          createdAt: '2026-05-18T00:00:00.000Z',
        }],
      }),
    },
  })

  await wrapper.get('button.agent-core-panel__trigger').trigger('click')
  await flushPromises()

  expect(wrapper.text()).toContain('Provider failed')
  expect(wrapper.text()).not.toContain('payloadJson')
})
```

**Step 2: Run failure**

Run:

```bash
npm run test -- components/AgentCorePanel.test.ts
```

Expected: FAIL.

**Step 3: Update composable types**

In `useAgentOs.ts`, extend types for:

- inbox item union
- task actions
- event list

Add methods from Task 7.

**Step 4: Update panel**

Keep one compact panel.

Sections:

- Header: status, owner, domain.
- Decision Inbox.
- Task Center.
- Audit Events.
- Current State.
- Sleep Report.
- Evolution Details.

Do not move Memory Planet content back into this panel.

**Step 5: CSS**

Add stable scroll region and compact rows.

Avoid overlapping chat dock and memory planet panel.

**Step 6: Update E2E**

Extend `tests/e2e/main-flow.spec.ts`:

- mock `/api/agents/current/events`
- mock expanded inbox item
- approve a memory governance item
- verify event history is visible

**Step 7: Run tests**

Run:

```bash
npm run test -- components/AgentCorePanel.test.ts
npm run test:e2e
```

Expected: PASS.

**Step 8: Commit**

```bash
git add composables/useAgentOs.ts components/AgentCorePanel.vue components/AgentCorePanel.test.ts pages/chat.vue assets/css/main.css tests/e2e/main-flow.spec.ts
git commit -m "feat: upgrade agent os console"
```

---

### Task 12: Add Privacy And Contract Regression Tests

**Why:** Completing OS APIs increases leak risk. Lock the contracts before final verification.

**Files:**

- Modify: `server/api/agent.os.test.ts`
- Modify: `server/api/public-stars.get.test.ts`
- Modify: `server/api/agent.core.test.ts`
- Modify: `server/services/agent-os.test.ts`
- Modify: `tests/e2e/main-flow.spec.ts`

**Step 1: Add privacy assertions**

Assert these responses do not contain sensitive fields:

- `/api/agents/current/os`
- `/api/agents/current/inbox`
- `/api/agents/current/events`
- `/api/agent/core`
- `/api/public-stars`

Forbidden substrings:

- `keyLookupHash`
- `createdIpHash`
- `session`
- `payloadJson`
- `rawJson`
- `data:image`
- `data:audio`
- `sourceConversationId` in public API
- provider raw body

**Step 2: Add API contract assertions**

Assert inbox IDs are typed:

- `proposal:<id>`
- `work_visibility:<id>`
- `memory_governance:<id>:<action>`
- `task_approval:<id>`
- `rollback:<id>`

**Step 3: Run tests**

Run:

```bash
npm run test -- server/api/agent.os.test.ts server/api/public-stars.get.test.ts server/api/agent.core.test.ts server/services/agent-os.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add server/api/agent.os.test.ts server/api/public-stars.get.test.ts server/api/agent.core.test.ts server/services/agent-os.test.ts tests/e2e/main-flow.spec.ts
git commit -m "test: lock agent os privacy contracts"
```

---

### Task 13: Update Architecture Documentation

**Files:**

- Modify: `docs/plans/2026-05-18-agent-os-layered-architecture-design.md`
- Modify: `README.md`
- Create or modify: `docs/deployment.md`

**Step 1: Update design status**

In `docs/plans/2026-05-18-agent-os-layered-architecture-design.md`, add a status appendix:

- implemented
- completed by this plan
- still future

Future should include only:

- background worker
- multi-agent collaboration
- third-party provider UI
- full physical `agent_id` migration

**Step 2: Update README**

Add a short Agent OS section:

- key owns an agent through binding
- private Agent OS APIs require session
- public universe only exposes explicit public works

**Step 3: Run docs-free verification**

Run:

```bash
npm run test
```

Expected: PASS.

**Step 4: Commit**

```bash
git add docs/plans/2026-05-18-agent-os-layered-architecture-design.md README.md docs/deployment.md
git commit -m "docs: update agent os architecture status"
```

---

### Task 14: Full Verification

**Files:**

- Inspect only.

**Step 1: Run unit tests**

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

**Step 3: Run E2E**

Run:

```bash
npm run test:e2e
```

Expected: PASS.

**Step 4: Inspect direct MiniMax construction**

Run:

```bash
rg -n "createMiniMaxClient\\(" server/api server/services
```

Expected:

- direct creation allowed only in provider factory or non-Agent legacy media routes not yet moved by this plan.
- no direct MiniMax creation in Agent runtime paths:
  - `server/api/agent/sleep.post.ts`
  - `server/api/agent/design-proposals/[id].post.ts`
  - `server/api/chat/stream.post.ts` for learning/reflection

**Step 5: Inspect OS API surface**

Run:

```bash
find server/api/agents -type f | sort
```

Expected includes:

- `server/api/agents/current.get.ts`
- `server/api/agents/current/os.get.ts`
- `server/api/agents/current/tasks.get.ts`
- `server/api/agents/current/tasks.post.ts`
- `server/api/agents/current/tasks/[id].put.ts`
- `server/api/agents/current/inbox.get.ts`
- `server/api/agents/current/inbox/[id]/approve.post.ts`
- `server/api/agents/current/inbox/[id]/reject.post.ts`
- `server/api/agents/current/events.get.ts`

**Step 6: Final worktree check**

Run:

```bash
git status --short
```

Expected: clean.

---

## Final Success Criteria

The implementation is complete when all criteria below are true:

- Agent observations exist and are written by chat, design, media, approval, and memory governance flows.
- Provider creation is centralized behind Agent provider registry for Agent paths.
- Star business abilities are registered as Agent tools.
- High-risk tools are evaluated by policy before execution.
- Task queue can enqueue, run, cancel, complete, fail, and wait for approval.
- Missing OS APIs are implemented.
- Inbox includes proposals, work publishing, memory governance, waiting-approval tasks, and rollback candidates.
- Agent events record task, approval, tool, provider, policy, and observation events.
- OS APIs never expose raw payloads or private model/provider bodies.
- Existing business endpoints remain compatible.
- Agent Core displays OS state, inbox, task center, audit events, current state, sleep report, and evolution details.
- Memory Planet remains a business visualization, not the OS console.
- Public universe exposes only configured public stars and explicit public work summaries.
- `npm run test`, `npm run build`, and `npm run test:e2e` pass.
