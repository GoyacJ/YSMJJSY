# Agent OS Runtime Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the current Agent OS runtime gaps: real loop boundary, task creation UX, policy consistency, provider decoupling, media runtime unification, design rollback, observation-driven planning, and recoverable task execution.

**Architecture:** Keep the current key-scoped product stable. Harden Agent OS as a compatibility runtime over existing SQLite tables first, then move business actions behind policy-controlled task/tool execution. Do not introduce external queues or multi-agent orchestration in this phase; add a local recoverable runner and explicit planner seams.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Nitro server routes, better-sqlite3, MiniMax, Zod, Vitest, Vue Test Utils, Playwright.

---

## Current Facts

- Business state is still keyed by `key_id`.
- Agent identity is attached through `agent_instances` and `agent_bindings`.
- Agent OS routes exist under `server/api/agents/current/*`.
- Agent Core UI is `components/AgentCorePanel.vue`.
- Task runner exists in `server/services/agent-task-queue.ts`.
- AgentLoop exists but is a thin wrapper in `server/services/agent-loop.ts`.
- Provider registry exists but provider types still reference MiniMax message types.
- Media legacy APIs still create MiniMax clients directly.
- Page design snapshots cannot currently be restored by `restoreAgentSnapshotAction`.
- Observations are stored but not used as planner input.
- Tasks are synchronous and not recovered after restart.

## Success Criteria

- AgentLoop has a real runtime boundary with observation intake, planning, task dispatch, and recovery hooks.
- Users can create supported Agent tasks from Agent Core UI without manually knowing `toolName`.
- All mutating Star actions that affect memory, publishing, design, or rollback are evaluated through one policy path.
- Agent model provider interfaces no longer expose MiniMax-specific message types.
- Media generation has one Agent runtime registration path for Agent-owned flows.
- Page design rollback restores a previous design version or creates a restored version.
- Observations feed a minimal planner that can propose tasks without executing them.
- Running tasks can be recovered to `failed` or `queued` after process restart by explicit recovery API/service.
- `npm run test`, `npm run build`, and `npm run test:e2e` pass.

---

### Task 1: Strengthen AgentLoop Boundary

**Problem:** `createAgentLoop` only forwards `runTask` to `runAgentTask`. It does not represent a real runtime boundary.

**Files:**

- Modify: `server/services/agent-loop.ts`
- Create: `server/services/agent-loop-planner.ts`
- Modify: `server/services/agent-loop.test.ts`
- Create: `server/services/agent-loop-planner.test.ts`

**Step 1: Write failing planner test**

Add `server/services/agent-loop-planner.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { planAgentTasksFromObservations } from './agent-loop-planner'

describe('agent loop planner', () => {
  it('plans a sleep task when recent observations exceed the threshold', () => {
    const tasks = planAgentTasksFromObservations({
      observations: [
        { id: 'o1', sourceType: 'chat', summary: '用户聊天。', createdAt: '2026-05-18T00:00:00.000Z' },
        { id: 'o2', sourceType: 'chat', summary: '助手回复。', createdAt: '2026-05-18T00:01:00.000Z' },
        { id: 'o3', sourceType: 'chat', summary: '用户继续聊天。', createdAt: '2026-05-18T00:02:00.000Z' },
      ],
      existingTasks: [],
      threshold: 3,
    } as any)

    expect(tasks).toEqual([
      {
        type: 'sleep',
        title: '睡眠整理',
        summary: '根据最近观察整理记忆和提案。',
        input: { toolName: 'star.sleep', input: {} },
      },
    ])
  })

  it('does not plan duplicate sleep tasks when one is already queued or running', () => {
    const tasks = planAgentTasksFromObservations({
      observations: [
        { id: 'o1', sourceType: 'chat', summary: '用户聊天。', createdAt: '2026-05-18T00:00:00.000Z' },
        { id: 'o2', sourceType: 'chat', summary: '助手回复。', createdAt: '2026-05-18T00:01:00.000Z' },
        { id: 'o3', sourceType: 'chat', summary: '用户继续聊天。', createdAt: '2026-05-18T00:02:00.000Z' },
      ],
      existingTasks: [
        { id: 'task_1', type: 'sleep', status: 'queued' },
      ],
      threshold: 3,
    } as any)

    expect(tasks).toEqual([])
  })
})
```

**Step 2: Run failure**

Run:

```bash
npm run test -- server/services/agent-loop-planner.test.ts
```

Expected: FAIL because `agent-loop-planner` does not exist.

**Step 3: Implement minimal planner**

Create `server/services/agent-loop-planner.ts`:

```ts
import type { AgentObservationRecord, AgentTaskRecord, AgentTaskType } from '../db/sqlite'

export type PlannedAgentTask = {
  type: AgentTaskType
  title: string
  summary: string
  input: Record<string, unknown>
}

export function planAgentTasksFromObservations(input: {
  observations: Array<Pick<AgentObservationRecord, 'sourceType' | 'summary' | 'createdAt'>>
  existingTasks: Array<Pick<AgentTaskRecord, 'type' | 'status'>>
  threshold?: number
}): PlannedAgentTask[] {
  const threshold = input.threshold ?? 6
  const hasActiveSleep = input.existingTasks.some(task =>
    task.type === 'sleep' && (task.status === 'queued' || task.status === 'running' || task.status === 'waiting_approval')
  )

  if (hasActiveSleep) {
    return []
  }

  const chatObservationCount = input.observations.filter(item => item.sourceType === 'chat').length

  if (chatObservationCount < threshold) {
    return []
  }

  return [{
    type: 'sleep',
    title: '睡眠整理',
    summary: '根据最近观察整理记忆和提案。',
    input: { toolName: 'star.sleep', input: {} },
  }]
}
```

**Step 4: Extend AgentLoop API**

Modify `server/services/agent-loop.ts`:

- Keep `runTask`.
- Add `planTasks(input)`.
- Add `recoverTasks(input)`.
- Do not enqueue automatically in this task.

Expected shape:

```ts
export type AgentLoop = {
  runTask: (task: AgentTaskRecord, options?: { approvalGranted?: boolean }) => Promise<void>
  planTasks: (input: {
    observations: Parameters<typeof planAgentTasksFromObservations>[0]['observations']
    existingTasks: Parameters<typeof planAgentTasksFromObservations>[0]['existingTasks']
  }) => PlannedAgentTask[]
  recoverTasks: (tasks: AgentTaskRecord[]) => AgentTaskRecord[]
}
```

`recoverTasks` should return tasks with `status === 'running'`. Actual DB updates come in Task 8.

**Step 5: Add loop tests**

Extend `server/services/agent-loop.test.ts`:

```ts
it('plans tasks through the loop planner', () => {
  const loop = createAgentLoop({ now: '2026-05-18T00:00:00.000Z', tasks: { updateTask: vi.fn() }, events: { addEvent: vi.fn() }, registry: { get: vi.fn(), execute: vi.fn() }, policy: {} } as any)

  expect(loop.planTasks({
    observations: [
      { sourceType: 'chat', summary: '1', createdAt: '2026-05-18T00:00:00.000Z' },
      { sourceType: 'chat', summary: '2', createdAt: '2026-05-18T00:01:00.000Z' },
      { sourceType: 'chat', summary: '3', createdAt: '2026-05-18T00:02:00.000Z' },
    ],
    existingTasks: [],
  })).toMatchObject([{ type: 'sleep' }])
})
```

**Step 6: Verify**

Run:

```bash
npm run test -- server/services/agent-loop.test.ts server/services/agent-loop-planner.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add server/services/agent-loop.ts server/services/agent-loop.test.ts server/services/agent-loop-planner.ts server/services/agent-loop-planner.test.ts
git commit -m "feat: strengthen agent loop boundary"
```

---

### Task 2: Add Task Intent Mapping For UI-Created Tasks

**Problem:** `/api/agents/current/tasks` requires callers to know raw `toolName`.

**Files:**

- Create: `server/services/agent-task-intents.ts`
- Create: `server/services/agent-task-intents.test.ts`
- Modify: `server/api/agents/current/tasks.post.ts`
- Modify: `server/api/agent.os.test.ts`

**Step 1: Write failing intent tests**

Create `server/services/agent-task-intents.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildAgentTaskInputFromIntent } from './agent-task-intents'

describe('agent task intents', () => {
  it('maps generate image tasks to star.generateImage tool input', () => {
    expect(buildAgentTaskInputFromIntent({
      type: 'generate_artifact',
      input: { artifactType: 'image', prompt: '月光森林' },
    })).toEqual({
      toolName: 'star.generateImage',
      input: { prompt: '月光森林' },
    })
  })

  it('maps publish artifact tasks to star.publishWork tool input', () => {
    expect(buildAgentTaskInputFromIntent({
      type: 'publish_artifact',
      input: { workId: 'work_1' },
    })).toEqual({
      toolName: 'star.publishWork',
      input: { workId: 'work_1' },
    })
  })
})
```

**Step 2: Run failure**

```bash
npm run test -- server/services/agent-task-intents.test.ts
```

Expected: FAIL.

**Step 3: Implement mapper**

Create `server/services/agent-task-intents.ts`:

```ts
import { createError } from 'h3'
import type { AgentTaskType } from '../db/sqlite'

function readString(input: Record<string, unknown>, key: string) {
  const value = input[key]

  if (typeof value !== 'string' || !value.trim()) {
    throw createError({ statusCode: 400, statusMessage: `Missing ${key}` })
  }

  return value.trim()
}

export function buildAgentTaskInputFromIntent(input: {
  type: AgentTaskType
  input: Record<string, unknown>
}) {
  if (input.type === 'generate_artifact') {
    const artifactType = readString(input.input, 'artifactType')
    const prompt = readString(input.input, 'prompt')

    if (artifactType === 'image') return { toolName: 'star.generateImage', input: { prompt } }
    if (artifactType === 'music') return { toolName: 'star.generateMusic', input: { prompt } }
    if (artifactType === 'video') return { toolName: 'star.generateVideo', input: { prompt } }

    throw createError({ statusCode: 400, statusMessage: 'Unsupported artifact type' })
  }

  if (input.type === 'publish_artifact') {
    return {
      toolName: 'star.publishWork',
      input: { workId: readString(input.input, 'workId') },
    }
  }

  if (input.type === 'govern_memory') {
    return {
      toolName: 'star.governMemory',
      input: {
        memoryId: readString(input.input, 'memoryId'),
        action: readString(input.input, 'action'),
        reason: typeof input.input.reason === 'string' ? input.input.reason : '',
      },
    }
  }

  if (input.type === 'preview_design') {
    return {
      toolName: 'star.previewDesign',
      input: input.input,
    }
  }

  return input.input.toolName ? input.input : { toolName: 'star.noop', input: input.input }
}
```

**Step 4: Wire task creation**

Modify `server/api/agents/current/tasks.post.ts`:

- Import `buildAgentTaskInputFromIntent`.
- In `enqueueCurrentAgentTask`, transform `body.input` before `enqueueAgentTask`.
- Store normalized input in `inputJson`.

**Step 5: Add API test**

In `server/api/agent.os.test.ts`, add a test for `enqueueCurrentAgentTask`:

```ts
it('normalizes UI task intent before enqueueing', () => {
  const addTask = vi.fn()
  const addEvent = vi.fn()

  const result = enqueueCurrentAgentTask({
    agentId: 'agent_1',
    now: '2026-05-18T00:00:00.000Z',
    body: { type: 'publish_artifact', input: { workId: 'work_1' } },
    tasks: { addTask },
    events: { addEvent },
  } as any)

  expect(result.task.type).toBe('publish_artifact')
  expect(addTask).toHaveBeenCalledWith(expect.objectContaining({
    inputJson: JSON.stringify({ toolName: 'star.publishWork', input: { workId: 'work_1' } }),
  }))
})
```

**Step 6: Verify**

```bash
npm run test -- server/services/agent-task-intents.test.ts server/api/agent.os.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add server/services/agent-task-intents.ts server/services/agent-task-intents.test.ts server/api/agents/current/tasks.post.ts server/api/agent.os.test.ts
git commit -m "feat: map agent task intents to tools"
```

---

### Task 3: Add Task Creation UI In Agent Core

**Problem:** The frontend can run/cancel existing tasks but cannot create useful tasks.

**Files:**

- Modify: `composables/useAgentOs.ts`
- Modify: `components/AgentCorePanel.vue`
- Modify: `components/AgentCorePanel.test.ts`

**Step 1: Add failing UI test**

In `components/AgentCorePanel.test.ts`, add:

```ts
it('creates a publish task from the task center', async () => {
  const enqueueTask = vi.fn(async () => ({ id: 'task_1' }))
  const wrapper = mount(AgentCorePanel, {
    props: {
      embedded: true,
      loadCore: async () => core,
      loadOs: async () => ({
        agent: { id: 'agent_1', status: 'active', ownerType: 'key', ownerId: 'key_1', domain: 'star' },
        inbox: [],
        tasks: [],
        events: [],
      }),
      enqueueTask,
    },
  })

  await flushPromises()
  await wrapper.get('[aria-label="创建公开作品任务"]').trigger('click')

  expect(enqueueTask).toHaveBeenCalledWith({
    type: 'publish_artifact',
    input: expect.objectContaining({}),
  })
})
```

**Step 2: Run failure**

```bash
npm run test -- components/AgentCorePanel.test.ts
```

Expected: FAIL because prop/control does not exist.

**Step 3: Extend composable type**

Modify `composables/useAgentOs.ts`:

- Export `AgentTaskCreateInput`.
- Type `type` as supported task types if useful.

**Step 4: Add prop and controls**

Modify `components/AgentCorePanel.vue`:

- Add prop `enqueueTask?: (input: AgentTaskCreateInput) => Promise<AgentOsTaskItem | null>`.
- Add a compact task creation area inside Task Center.
- First version supports:
  - `publish_artifact` from selected/first private work is not available in this component, so create a generic disabled-free control only if `workId` input exists.
  - `generate_artifact` image with a small prompt input.

Prefer this initial UI:

```vue
<div class="agent-core-panel__task-create">
  <input v-model="taskPrompt" aria-label="任务提示词" maxlength="120">
  <button type="button" aria-label="创建图片任务" @click="createImageTask">图片任务</button>
</div>
```

Implementation:

```ts
const taskPrompt = ref('')

async function createImageTask() {
  const prompt = taskPrompt.value.trim()
  if (!prompt) return
  const created = props.enqueueTask
    ? await props.enqueueTask({ type: 'generate_artifact', input: { artifactType: 'image', prompt } })
    : await agentOs.enqueueTask({ type: 'generate_artifact', input: { artifactType: 'image', prompt } })
  if (created) await loadPanel()
}
```

**Step 5: Adjust test**

If using image task instead of publish task, update the failing test to:

```ts
await wrapper.get('[aria-label="任务提示词"]').setValue('月光森林')
await wrapper.get('[aria-label="创建图片任务"]').trigger('click')
expect(enqueueTask).toHaveBeenCalledWith({
  type: 'generate_artifact',
  input: { artifactType: 'image', prompt: '月光森林' },
})
```

**Step 6: Verify**

```bash
npm run test -- components/AgentCorePanel.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add composables/useAgentOs.ts components/AgentCorePanel.vue components/AgentCorePanel.test.ts
git commit -m "feat: add agent task creation controls"
```

---

### Task 4: Route Legacy Mutating Actions Through Policy-Controlled Tasks

**Problem:** Legacy routes can execute memory governance and work publishing through tools without the task policy path.

**Files:**

- Modify: `server/api/agent/memories/[id].put.ts`
- Modify: `server/api/agent/works/[id].put.ts`
- Modify: `server/api/agent.memory.test.ts`
- Modify: `server/api/agent.works.test.ts`

**Step 1: Add failing tests**

For memory governance:

```ts
it('requires approval for memory rejection through the agent task runner', async () => {
  const updateTask = vi.fn()
  const addEvent = vi.fn()

  // call extracted helper with action reject and default policy
  // expect status waiting_approval instead of direct memory update
})
```

For work publishing:

```ts
it('creates a waiting approval task for public work publishing', async () => {
  // call extracted helper for public visibility
  // expect task status waiting_approval and work not updated directly
})
```

If current route helpers are hard to test, first extract pure helpers:

- `publishWorkActionOrTask`
- `governMemoryActionOrTask`

**Step 2: Run failure**

```bash
npm run test -- server/api/agent.memory.test.ts server/api/agent.works.test.ts
```

Expected: FAIL.

**Step 3: Implement policy path**

Rules:

- Direct legacy action may still execute low/medium safe actions only if policy allows no approval.
- `star.publishWork` must create or run a task and stop at `waiting_approval`.
- `star.governMemory` with `reject` or archive must create or run a task and stop at `waiting_approval`.
- The response should return:

```ts
{
  status: 'waiting_approval',
  taskId: task.id,
}
```

**Step 4: Reuse existing runner**

Use:

- `createAgentToolRegistry`
- `registerDefaultStarAgentTools`
- `enqueueAgentTask`
- `createAgentLoop`
- `defaultAgentPolicy`

Do not duplicate policy logic inside routes.

**Step 5: Verify**

```bash
npm run test -- server/api/agent.memory.test.ts server/api/agent.works.test.ts server/services/agent-task-queue.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/api/agent/memories/[id].put.ts server/api/agent/works/[id].put.ts server/api/agent.memory.test.ts server/api/agent.works.test.ts
git commit -m "fix: enforce policy for legacy agent mutations"
```

---

### Task 5: Decouple Agent Provider Types From MiniMax

**Problem:** `AgentModelProvider` still depends on `MiniMaxMessage`.

**Files:**

- Modify: `server/services/agent-runtime.ts`
- Modify: `server/services/agent-providers.ts`
- Modify: `server/services/agent-runtime.test.ts`
- Modify: `server/services/agent-providers.test.ts`
- Modify: `server/api/chat/stream.post.ts`
- Modify: `server/api/agent/sleep.post.ts`

**Step 1: Add failing type-level behavior test**

Modify `server/services/agent-runtime.test.ts`:

```ts
it('uses provider-neutral agent messages', async () => {
  const provider = createMiniMaxAgentModelProvider({
    chat: vi.fn(async () => ({ reply: 'ok' })),
    reflectAgent: vi.fn(async () => '{"summary":"ok"}'),
    generateDesignPatch: vi.fn(async input => input.currentSchema),
  } as any)

  await provider.reflect([{ role: 'user', content: 'hello' }])
  expect(typeof provider.reflect).toBe('function')
})
```

**Step 2: Run affected tests**

```bash
npm run test -- server/services/agent-runtime.test.ts server/services/agent-providers.test.ts
```

Expected: currently may pass structurally, but type coupling remains. Continue with refactor.

**Step 3: Introduce neutral types**

In `server/services/agent-runtime.ts`:

```ts
export type AgentModelMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}
```

Change:

```ts
chat: (messages: AgentModelMessage[]) => Promise<ChatResult>
reflect: (messages: AgentModelMessage[]) => Promise<string>
```

`MiniMaxMessage` should only appear in the MiniMax provider adapter.

**Step 4: Convert adapter**

In `createMiniMaxAgentModelProvider`, cast or map `AgentModelMessage[]` to MiniMax messages:

```ts
function toMiniMaxMessages(messages: AgentModelMessage[]): MiniMaxMessage[] {
  return messages.map(message => ({
    role: message.role,
    content: message.content,
  }))
}
```

**Step 5: Update call sites**

Ensure these still compile:

- `server/api/chat/stream.post.ts`
- `server/api/agent/sleep.post.ts`
- `server/api/design/preview.post.ts`
- `server/api/agent/design-proposals/[id].post.ts`

**Step 6: Verify**

```bash
npm run test -- server/services/agent-runtime.test.ts server/services/agent-providers.test.ts server/api/chat.post.test.ts server/api/agent.sleep.test.ts server/api/design.test.ts
npm run build
```

Expected: PASS.

**Step 7: Commit**

```bash
git add server/services/agent-runtime.ts server/services/agent-providers.ts server/services/agent-runtime.test.ts server/services/agent-providers.test.ts server/api/chat/stream.post.ts server/api/agent/sleep.post.ts server/api/design/preview.post.ts server/api/agent/design-proposals/[id].post.ts
git commit -m "refactor: decouple agent provider message types"
```

---

### Task 6: Unify Media Runtime For Agent-Owned Flows

**Problem:** Media APIs still create MiniMax clients directly and register partial Star tools.

**Files:**

- Modify: `server/services/star-agent-runtime.ts`
- Modify: `server/api/image.post.ts`
- Modify: `server/api/music.post.ts`
- Modify: `server/api/video/tasks.post.ts`
- Modify: `server/api/media.test.ts`
- Modify: `server/api/chat.post.test.ts`

**Step 1: Add runtime test**

Create or extend `server/services/star-agent-tools.test.ts`:

```ts
it('registers default media tools through the default runtime', async () => {
  const registry = createAgentToolRegistry()

  registerDefaultStarAgentTools(registry, {
    minimaxApiKey: 'key',
    media: {
      generateImage: vi.fn(async () => ({ url: 'image' })),
      generateMusic: vi.fn(async () => ({ url: 'music' })),
      createVideoTask: vi.fn(async () => ({ providerTaskId: 'video' })),
    },
  } as any)

  await expect(registry.execute('star.generateImage', { prompt: 'x' })).resolves.toMatchObject({ ok: true })
})
```

**Step 2: Run failure or baseline**

```bash
npm run test -- server/services/star-agent-tools.test.ts
```

Expected: PASS after current P1/P2 changes or fail if imports missing.

**Step 3: Replace direct partial registration**

In these files:

- `server/api/image.post.ts`
- `server/api/music.post.ts`
- `server/api/video/tasks.post.ts`

Use `registerDefaultStarAgentTools` instead of `createMiniMaxClient + registerStarAgentTools`.

Keep direct `createMiniMaxClient` only in:

- `server/services/agent-providers.ts`
- `server/services/star-agent-runtime.ts`
- `server/api/video/tasks/[id].get.ts` for polling if not yet modeled as a tool
- `server/api/minimax/quota.get.ts`
- `server/api/tts.post.ts`

**Step 4: Verify direct MiniMax construction**

Run:

```bash
rg "createMiniMaxClient\\(" server/api server/services -n
```

Expected allowed paths only:

- `server/services/minimax.ts`
- `server/services/agent-providers.ts`
- `server/services/star-agent-runtime.ts`
- `server/api/chat/stream.post.ts` for main chat/image understanding only
- `server/api/video/tasks/[id].get.ts`
- `server/api/minimax/quota.get.ts`
- `server/api/tts.post.ts`

**Step 5: Verify**

```bash
npm run test -- server/api/media.test.ts server/api/chat.post.test.ts server/services/star-agent-tools.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/services/star-agent-runtime.ts server/api/image.post.ts server/api/music.post.ts server/api/video/tasks.post.ts server/api/media.test.ts server/api/chat.post.test.ts server/services/star-agent-tools.test.ts
git commit -m "refactor: centralize agent media runtime"
```

---

### Task 7: Fix Page Design Rollback

**Problem:** Page design snapshots do not contain `agentState`, so `restoreAgentSnapshotAction` cannot restore them.

**Files:**

- Modify: `server/api/design/commit.post.ts`
- Modify: `server/api/agent/snapshots/[id]/restore.post.ts`
- Modify: `server/api/design.test.ts`
- Modify: `server/api/agent.os.test.ts`

**Step 1: Add failing restore test**

In `server/api/design.test.ts`:

```ts
it('restores a page design snapshot by creating a new design version', () => {
  const addKeyDesign = vi.fn()
  const result = restoreAgentSnapshotAction({
    keyId: 'key_1',
    snapshotId: 'snapshot_1',
    now: '2026-05-18T00:00:00.000Z',
    snapshots: {
      getSnapshotByKey: () => ({
        id: 'snapshot_1',
        keyId: 'key_1',
        proposalId: 'proposal_1',
        profileJson: JSON.stringify({
          acceptedProposal: {
            type: 'page_design',
            payload: {
              version: 2,
              schema: { title: '旧页面', theme: {}, sections: [] },
            },
          },
        }),
        createdAt: '2026-05-18T00:00:00.000Z',
      }),
    },
    states: { updateAgentState: vi.fn() },
    designs: {
      getLatestDesign: () => ({ keyId: 'key_1', version: 3 }),
      addKeyDesign,
    },
  } as any)

  expect(result.restored).toBe(true)
  expect(addKeyDesign).toHaveBeenCalledWith(expect.objectContaining({
    keyId: 'key_1',
    version: 4,
  }))
})
```

**Step 2: Run failure**

```bash
npm run test -- server/api/design.test.ts server/api/agent.os.test.ts
```

Expected: FAIL.

**Step 3: Extend restore input**

Modify `RestoreAgentSnapshotActionInput`:

```ts
designs?: {
  getLatestDesign: (keyId: string) => { version: number } | undefined
  addKeyDesign: (record: { keyId: string, version: number, schemaJson: string, prompt: string, createdAt: string }) => void
}
```

**Step 4: Restore design snapshots**

In `restoreAgentSnapshotAction`:

- Parse `acceptedProposal.type`.
- If `page_design`, require `designs`.
- Validate schema with `parseDesignSchema`.
- Add new design version with prompt `restore snapshot <snapshotId>`.
- Return `{ restored: true, snapshotId, restoredType: 'page_design', version }`.

Do not overwrite old versions.

**Step 5: Keep agent state restore**

Existing agent state restore must continue to pass.

**Step 6: Wire route**

In default handler:

- Pass `createKeyDesignRepository(config.sqlitePath)` as `designs`.

**Step 7: Verify**

```bash
npm run test -- server/api/design.test.ts server/api/agent.os.test.ts
```

Expected: PASS.

**Step 8: Commit**

```bash
git add server/api/design/commit.post.ts server/api/agent/snapshots/[id]/restore.post.ts server/api/design.test.ts server/api/agent.os.test.ts
git commit -m "fix: restore page design snapshots"
```

---

### Task 8: Add Explicit Task Recovery

**Problem:** Running tasks are not recovered after process restart.

**Files:**

- Modify: `server/db/sqlite.ts`
- Modify: `server/db/sqlite.test.ts`
- Create: `server/services/agent-task-recovery.ts`
- Create: `server/services/agent-task-recovery.test.ts`
- Modify: `server/api/agents/current/tasks.get.ts`

**Step 1: Add repository test**

In `server/db/sqlite.test.ts`:

```ts
it('lists running agent tasks for recovery', () => {
  const repo = createAgentTaskRepository(':memory:')
  repo.addTask({
    id: 'task_1',
    agentId: 'agent_1',
    type: 'generate_artifact',
    status: 'running',
    title: '生成作品',
    summary: '生成。',
    inputJson: '{}',
    resultJson: null,
    error: null,
    createdAt: '2026-05-18T00:00:00.000Z',
    updatedAt: '2026-05-18T00:00:00.000Z',
  })

  expect(repo.listTasksByStatus('running')).toMatchObject([{ id: 'task_1' }])
})
```

**Step 2: Run failure**

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected: FAIL because `listTasksByStatus` does not exist.

**Step 3: Add repository method**

In `createAgentTaskRepository`, add:

```ts
listTasksByStatus(status: AgentTaskStatus, limit = 100): AgentTaskRecord[]
```

Order by `updated_at ASC`.

**Step 4: Add recovery service test**

Create `server/services/agent-task-recovery.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { recoverStaleRunningTasks } from './agent-task-recovery'

describe('agent task recovery', () => {
  it('marks stale running tasks as failed and writes an event', () => {
    const updateTask = vi.fn()
    const addEvent = vi.fn()

    recoverStaleRunningTasks({
      now: '2026-05-18T02:00:00.000Z',
      staleAfterMs: 60 * 60 * 1000,
      tasks: [
        {
          id: 'task_1',
          agentId: 'agent_1',
          type: 'generate_artifact',
          status: 'running',
          title: '生成作品',
          summary: '生成。',
          inputJson: '{}',
          resultJson: null,
          error: null,
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
        },
      ],
      taskRepo: { updateTask },
      events: { addEvent },
    } as any)

    expect(updateTask).toHaveBeenCalledWith('task_1', expect.objectContaining({
      status: 'failed',
    }))
    expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'task.failed',
    }))
  })
})
```

**Step 5: Implement recovery service**

Create `server/services/agent-task-recovery.ts`:

```ts
import type { AgentEventRecord, AgentTaskRecord } from '../db/sqlite'
import { failAgentTask } from './agent-task-queue'

export function recoverStaleRunningTasks(input: {
  now: string
  staleAfterMs: number
  tasks: AgentTaskRecord[]
  taskRepo: { updateTask: (id: string, updates: Partial<Pick<AgentTaskRecord, 'status' | 'resultJson' | 'error' | 'updatedAt'>>) => void }
  events: { addEvent: (record: AgentEventRecord) => void }
}) {
  for (const task of input.tasks) {
    if (Date.parse(input.now) - Date.parse(task.updatedAt) < input.staleAfterMs) {
      continue
    }

    failAgentTask({
      task,
      error: 'Task recovered as failed after stale running state.',
      now: input.now,
      tasks: input.taskRepo,
      events: input.events,
    })
  }
}
```

**Step 6: Wire safe recovery trigger**

In `server/api/agents/current/tasks.get.ts`:

- Before listing tasks, recover stale running tasks for this agent only.
- Use threshold 30 minutes.

This gives explicit recovery without global startup hooks.

**Step 7: Verify**

```bash
npm run test -- server/db/sqlite.test.ts server/services/agent-task-recovery.test.ts server/api/agent.os.test.ts
```

Expected: PASS.

**Step 8: Commit**

```bash
git add server/db/sqlite.ts server/db/sqlite.test.ts server/services/agent-task-recovery.ts server/services/agent-task-recovery.test.ts server/api/agents/current/tasks.get.ts server/api/agent.os.test.ts
git commit -m "feat: recover stale agent tasks"
```

---

### Task 9: Use Observations In OS Planning

**Problem:** Observations are stored but not used.

**Files:**

- Modify: `server/api/agents/current/os.get.ts`
- Modify: `server/api/agents/current/tasks.post.ts`
- Modify: `server/api/agent.os.test.ts`
- Modify: `components/AgentCorePanel.vue`
- Modify: `components/AgentCorePanel.test.ts`

**Step 1: Add OS response test**

In `server/api/agent.os.test.ts`:

```ts
it('includes planned tasks from recent observations without executing them', () => {
  const result = buildCurrentAgentOsResponse({
    keyId: 'key_1',
    now: '2026-05-18T00:00:00.000Z',
    agents: { getOrCreateAgentForOwner: () => agent },
    tasks: { listTasksByAgent: () => [] },
    events: { listEventsByAgent: () => [] },
    proposals: { listProposalsByKey: () => [] },
    works: { listWorksByKey: () => [] },
    observations: {
      listObservationsByAgent: () => [
        { sourceType: 'chat', summary: '1', createdAt: '2026-05-18T00:00:00.000Z' },
        { sourceType: 'chat', summary: '2', createdAt: '2026-05-18T00:01:00.000Z' },
        { sourceType: 'chat', summary: '3', createdAt: '2026-05-18T00:02:00.000Z' },
      ],
    },
  } as any)

  expect(result.plannedTasks).toMatchObject([{ type: 'sleep' }])
})
```

**Step 2: Run failure**

```bash
npm run test -- server/api/agent.os.test.ts
```

Expected: FAIL because `plannedTasks` is missing.

**Step 3: Extend OS response type**

In `server/services/agent-os.ts`, add:

```ts
plannedTasks?: Array<{
  type: string
  title: string
  summary: string
}>
```

Do not expose raw planner input.

**Step 4: Build planned tasks**

In `server/api/agents/current/os.get.ts`:

- Accept `observations`.
- Call `createAgentLoop(...).planTasks`.
- Include planned tasks in OS response.

**Step 5: Add enqueue from plan**

In `components/AgentCorePanel.vue`:

- Render planned tasks as suggestions.
- Button: `创建任务`.
- Calls `enqueueTask({ type: planned.type, input: planned.input })`.

If `input` should remain hidden from OS response, add server-side endpoint `POST /api/agents/current/tasks` with `{ type }` for planned sleep only.

Recommended: include sanitized `input` only for planned tasks generated by server-owned planner.

**Step 6: Verify**

```bash
npm run test -- server/api/agent.os.test.ts components/AgentCorePanel.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add server/services/agent-os.ts server/api/agents/current/os.get.ts server/api/agent.os.test.ts components/AgentCorePanel.vue components/AgentCorePanel.test.ts
git commit -m "feat: surface observation-based agent plans"
```

---

### Task 10: Privacy And Contract Hardening

**Problem:** More runtime data increases risk of exposing raw payloads.

**Files:**

- Modify: `server/services/agent-privacy.ts`
- Modify: `server/services/agent-os.test.ts`
- Modify: `server/api/agent.core.test.ts`
- Modify: `server/api/public-stars.get.test.ts`

**Step 1: Extend sensitive-key test**

In `server/services/agent-os.test.ts`, ensure OS responses never contain:

- `payloadJson`
- `rawJson`
- `rawProviderBody`
- `data:image`
- `data:audio`
- `keyLookupHash`
- `createdIpHash`
- `session`
- full `messageJson`

**Step 2: Run tests**

```bash
npm run test -- server/services/agent-os.test.ts server/api/agent.core.test.ts server/api/public-stars.get.test.ts
```

Expected: PASS or FAIL if newly exposed fields exist.

**Step 3: Harden sanitizer**

In `server/services/agent-privacy.ts`, add sensitive keys:

```ts
'messageJson',
'profileJson',
'schemaJson',
'dataUrl',
'base64',
'providerTaskId',
```

Only add keys that should never appear in OS/public list responses. Do not sanitize private internal route results that intentionally need schema.

**Step 4: Verify**

```bash
npm run test -- server/services/agent-os.test.ts server/api/agent.core.test.ts server/api/public-stars.get.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add server/services/agent-privacy.ts server/services/agent-os.test.ts server/api/agent.core.test.ts server/api/public-stars.get.test.ts
git commit -m "test: harden agent response privacy contracts"
```

---

### Task 11: Documentation Update

**Problem:** Current docs describe the intended layering, but not the hardened runtime boundary after these changes.

**Files:**

- Modify: `README.md`
- Modify: `docs/plans/2026-05-18-agent-os-layered-architecture-design.md`
- Create: `docs/agent-os-runtime.md`

**Step 1: Create runtime doc**

Create `docs/agent-os-runtime.md`:

```md
# Agent OS Runtime

Agent OS is the runtime layer below 星AI business features.

## Runtime Flow

1. Business route records observations.
2. AgentLoop reads observations and existing tasks.
3. Planner proposes safe tasks.
4. User or route enqueues a task.
5. Policy evaluates the tool.
6. Task runs or waits for approval.
7. Tool events and task events are written.
8. Inbox approval resumes waiting tasks.
9. Recovery marks stale running tasks as failed.

## Boundaries

- Business routes may collect context.
- Business routes must not bypass policy for high-risk mutations.
- Agent tools execute mutations.
- Agent OS serializes safe status only.
```

**Step 2: Update README**

Add one paragraph under `Agent OS`:

```md
AgentLoop owns task planning, policy-gated tool execution, approval resume, and stale task recovery. Business routes remain key-scoped, but high-risk mutations are represented as Agent tasks/tools before execution.
```

**Step 3: Verify docs references**

Run:

```bash
rg "AgentLoop|Agent OS Runtime|policy-gated" README.md docs
```

Expected: new docs found.

**Step 4: Commit**

```bash
git add README.md docs/agent-os-runtime.md docs/plans/2026-05-18-agent-os-layered-architecture-design.md
git commit -m "docs: document agent os runtime boundary"
```

---

### Task 12: Full Verification

**Files:**

- Inspect only.

**Step 1: Run unit tests**

```bash
npm run test
```

Expected: PASS.

**Step 2: Run build**

```bash
npm run build
```

Expected: PASS. Existing sourcemap warnings are acceptable.

**Step 3: Run E2E**

```bash
npm run test:e2e
```

Expected: PASS.

**Step 4: Inspect direct MiniMax construction**

```bash
rg "createMiniMaxClient\\(" server/api server/services -n
```

Expected:

- No direct construction in Agent learning, sleep, OS task execution, or design proposal paths.
- Direct construction remains only in provider/runtime factory or non-Agent utility routes.

**Step 5: Inspect task and policy paths**

```bash
rg "registerStarAgentTools|registerDefaultStarAgentTools|createAgentLoop|runAgentTask" server/api server/services -n
```

Expected:

- High-risk execution paths go through `createAgentLoop` or an explicit compatibility wrapper that uses the same policy.

**Step 6: Final status**

```bash
git status --short
```

Expected: clean after commits.

---

## Execution Notes

- Implement in order. Task 1 and Task 2 create the runtime foundation used later.
- Do not start with UI. UI depends on task intent mapping.
- Do not add a real background worker in this phase.
- Do not migrate all `key_id` tables to `agent_id`.
- Keep public universe read-only and summary-only.
- Keep existing `/api/agent/*` routes compatible.

