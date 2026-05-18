# Agent Autonomy Unfinished Work Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish the remaining autonomy, governance, works, timeline, and public-universe design so the key agent becomes a complete product loop rather than a collection of partial panels and APIs.

**Architecture:** Stabilize the current uncommitted autonomy implementation first, then close the missing loops in small vertical slices. Keep `/chat` as the private workspace, keep `MemoryPlanetPanel` as the main agent surface, and only expose explicit public data through `/api/public-stars`. Do not add background workers in this phase.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Nitro server routes, better-sqlite3, MiniMax client, Vitest, Vue Test Utils, Playwright, CSS.

---

## Current Gap Summary

The project already has the base implementation for:

- key-scoped agents
- chat and media generation
- memory extraction
- reflections
- evolution proposals
- Agent Core
- memory planet
- manual sleep run API
- memory governance API
- works API
- timeline API
- public stars with public work counts

The remaining gaps are:

1. Current autonomy implementation is uncommitted and needs verification.
2. Agent Core does not have a stable standalone product entry.
3. `page_design` evolution proposals are rejected instead of becoming design previews.
4. Sleep runs only expose a summary, not a full report.
5. Memory governance lacks source, event history, and duplicate prevention.
6. Works library lacks detail, preview, source, and filtering.
7. Timeline is still a flat event list.
8. Public universe shows counts, not public cards or agent profiles.
9. Proposal application lacks rollback UI and clear failure state.
10. Learning quality governance is incomplete.

---

## Execution Rules

- Work task by task.
- Use TDD for every behavior change.
- Keep public API payloads privacy-reviewed.
- Do not expose conversation text, private memory content, payload JSON, key hashes, IP hashes, or sessions through public APIs.
- After each task, run the focused test command listed in that task.
- After Task 11, run full verification.
- Commit after each task when working in a clean branch.

---

### Task 0: Stabilize Current Autonomy Work

**Files:**
- Inspect only first.
- Modify only if tests fail.

**Step 1: Inspect current status**

Run:

```bash
git status --short
```

Expected: current autonomy-related files may be modified.

**Step 2: Run focused autonomy tests**

Run:

```bash
npm run test -- server/db/sqlite.test.ts server/services/agent-learning.test.ts server/api/agent.core.test.ts server/api/agent.sleep.test.ts server/api/agent.memory.test.ts server/api/agent.works.test.ts server/api/agent.timeline.test.ts components/AgentCorePanel.test.ts components/MemoryPlanetPanel.test.ts server/api/chat.post.test.ts server/api/design.test.ts server/api/public-stars.get.test.ts utils/public-star-scene.test.ts components/PublicStarHome.test.ts
```

Expected: PASS.

**Step 3: Fix only failing tests**

If a test fails, fix the smallest related file.

Do not refactor unrelated code.

**Step 4: Run full verification**

Run:

```bash
npm run test
npm run build
npm run test:e2e
```

Expected: PASS.

**Step 5: Commit current stable baseline**

```bash
git add assets/css/main.css components/MemoryPlanetPanel.test.ts components/MemoryPlanetPanel.vue pages/chat.vue server/api/agent.core.test.ts server/api/agent.timeline.test.ts server/api/agent/core.get.ts server/api/agent/timeline.get.ts server/api/chat.post.test.ts server/api/chat/stream.post.ts
git commit -m "feat: finish agent autonomy baseline"
```

---

### Task 1: Restore A Stable Agent Core Entry

**Problem:** Agent Core is now mostly embedded inside Memory Planet. The product needs a clear route to agent state without forcing users into the planet view.

**Files:**
- Modify: `pages/chat.vue`
- Modify: `components/AgentCorePanel.vue`
- Modify: `components/AgentCorePanel.test.ts`
- Modify: `tests/e2e/main-flow.spec.ts`
- Modify: `assets/css/main.css`

**Step 1: Write failing e2e check**

In `tests/e2e/main-flow.spec.ts`, add:

```ts
await expect(page.getByRole('button', { name: '打开星AI' })).toBeVisible()
await page.getByRole('button', { name: '打开星AI' }).click()
await expect(page.getByLabel('星AI')).toBeVisible()
```

Expected: FAIL if the standalone entry is missing or hidden.

**Step 2: Wire standalone panel**

In `pages/chat.vue`, render:

```vue
<AgentCorePanel
  :load-core="loadAgentCore"
  :apply-proposal="applyAgentCoreProposal"
  :run-sleep="runSleep"
/>
```

Keep the embedded panel inside `MemoryPlanetPanel`.

**Step 3: Make layout non-overlapping**

In `assets/css/main.css`, ensure:

- Star memory entry remains top-right.
- Agent Core trigger sits below it or in a compact vertical stack.
- Mobile width hides long label only if needed.

**Step 4: Run tests**

Run:

```bash
npm run test -- components/AgentCorePanel.test.ts
npm run test:e2e
```

Expected: PASS.

**Step 5: Commit**

```bash
git add pages/chat.vue components/AgentCorePanel.vue components/AgentCorePanel.test.ts tests/e2e/main-flow.spec.ts assets/css/main.css
git commit -m "feat: restore standalone agent core entry"
```

---

### Task 2: Complete `page_design` Evolution

**Problem:** `page_design` proposals are currently rejected during accept. The design requires them to generate a design preview, then let the user confirm.

**Files:**
- Modify: `server/api/agent/proposals/[id].put.ts`
- Modify: `server/api/design/preview.post.ts`
- Create: `server/api/agent/design-proposals/[id].post.ts`
- Modify: `components/AgentCorePanel.vue`
- Modify: `components/AgentCorePanel.test.ts`
- Modify: `composables/useAgentCore.ts`
- Test: `server/api/agent.core.test.ts`
- Test: `server/api/design.test.ts`

**Step 1: Write failing proposal helper test**

In `server/api/agent.core.test.ts`, add:

```ts
it('keeps page design proposals pending and marks them as preview-required', () => {
  const result = applyAgentProposalAction({
    // same fake setup as existing proposal tests
    proposalId: 'p_design',
    action: 'accept',
    proposals: {
      listProposalsByKey: () => [{
        id: 'p_design',
        keyId: 'key_1',
        type: 'page_design',
        title: '调整页面',
        summary: '让页面更像星空。',
        payloadJson: JSON.stringify({ instruction: '更像星空' }),
        status: 'pending',
        createdAt: '2026-05-18T00:00:00.000Z',
        updatedAt: '2026-05-18T00:00:00.000Z',
      }],
      updateProposal: vi.fn(),
    },
    // other fake deps
  })

  expect(result?.status).toBe('pending')
  expect(result?.requiresPreview).toBe(true)
})
```

Expected: FAIL because current code rejects `page_design`.

**Step 2: Add design proposal preview API**

Create `server/api/agent/design-proposals/[id].post.ts`.

Behavior:

- Require key.
- Load proposal by key.
- Validate `proposal.type === 'page_design'`.
- Read `payload.instruction`.
- Reuse current design schema.
- Call MiniMax `generateDesignPatch`.
- Return `{ schema }`.
- Do not commit design.
- Do not mark proposal as applied.

**Step 3: Add frontend action**

In `useAgentCore.ts`, add:

```ts
async function previewDesignProposal(id: string) {
  return await $fetch<{ schema: StarPageDesignSchema }>(`/api/agent/design-proposals/${id}`, {
    method: 'POST',
  })
}
```

**Step 4: Render page design proposal action**

In `AgentCorePanel.vue`:

- For `proposal.type === 'page_design'`, show `生成预览`.
- Do not show normal `接受` as final application.
- Emit or call preview action.

If `AgentCorePanel` cannot own `DesignPreviewSheet`, pass a prop callback:

```ts
previewDesignProposal?: (id: string) => Promise<boolean>
```

Wire it in `pages/chat.vue` to set `previewSchema`.

**Step 5: Mark proposal applied only after design commit**

In `server/api/design/commit.post.ts`, accept optional `proposalId`.

After commit:

- update proposal status to `applied`
- write snapshot
- add `page_design` work

**Step 6: Run tests**

Run:

```bash
npm run test -- server/api/agent.core.test.ts server/api/design.test.ts components/AgentCorePanel.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add server/api/agent/proposals/[id].put.ts server/api/agent/design-proposals/[id].post.ts server/api/design/commit.post.ts composables/useAgentCore.ts components/AgentCorePanel.vue components/AgentCorePanel.test.ts pages/chat.vue server/api/agent.core.test.ts server/api/design.test.ts
git commit -m "feat: preview page design evolution proposals"
```

---

### Task 3: Expand Sleep Report Into A Real Thought Report

**Problem:** Sleep run returns `memoryActions`, `workIdeas`, and `nextConversationHints`, but the UI mostly shows only `summary`.

**Files:**
- Modify: `server/db/schema.ts`
- Modify: `server/db/sqlite.ts`
- Modify: `server/api/agent/sleep.post.ts`
- Modify: `server/api/agent/core.get.ts`
- Modify: `composables/useAgentCore.ts`
- Modify: `components/AgentCorePanel.vue`
- Modify: `components/AgentCorePanel.test.ts`
- Test: `server/db/sqlite.test.ts`
- Test: `server/api/agent.sleep.test.ts`

**Step 1: Store parsed sleep report**

Add columns to `agent_sleep_runs`:

```sql
memory_actions_json TEXT
work_ideas_json TEXT
next_conversation_hints_json TEXT
```

Add migrations through `ensureColumn`.

**Step 2: Write failing repository test**

In `server/db/sqlite.test.ts`:

```ts
it('stores parsed sleep report fields', () => {
  const repo = createAgentSleepRepository(':memory:')
  repo.addSleepRun({
    id: 'sleep_1',
    keyId: 'key_1',
    status: 'completed',
    summary: '整理完成。',
    rawJson: '{}',
    memoryActionsJson: '[{"memoryId":"m1","action":"confirm","reason":"明确表达"}]',
    workIdeasJson: '[{"type":"letter","title":"短句回信","summary":"写一封短信"}]',
    nextConversationHintsJson: '["承接短句偏好"]',
    startedAt: '2026-05-18T00:00:00.000Z',
    completedAt: '2026-05-18T00:01:00.000Z',
    error: null,
  })

  expect(repo.getLatestSleepRunByKey('key_1')?.memoryActionsJson).toContain('confirm')
})
```

Expected: FAIL until fields exist.

**Step 3: Persist parsed fields**

In `runManualAgentSleep`, when completed, save:

- `memoryActionsJson`
- `workIdeasJson`
- `nextConversationHintsJson`

**Step 4: Extend Agent Core response**

In `server/api/agent/core.get.ts`, include:

```ts
sleep.latestRun.memoryActions
sleep.latestRun.workIdeas
sleep.latestRun.nextConversationHints
```

Parse JSON defensively.

**Step 5: Render full report**

In `AgentCorePanel.vue`, under sleep cycle show:

- summary
- memory action count
- work ideas
- next conversation hints

Keep it compact.

**Step 6: Run tests**

Run:

```bash
npm run test -- server/db/sqlite.test.ts server/api/agent.sleep.test.ts server/api/agent.core.test.ts components/AgentCorePanel.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add server/db/schema.ts server/db/sqlite.ts server/api/agent/sleep.post.ts server/api/agent/core.get.ts composables/useAgentCore.ts components/AgentCorePanel.vue components/AgentCorePanel.test.ts server/db/sqlite.test.ts server/api/agent.sleep.test.ts server/api/agent.core.test.ts
git commit -m "feat: show full agent sleep report"
```

---

### Task 4: Add Sleep Reminder Scheduling

**Problem:** `nextSleepAt` exists but does not represent a real scheduling policy.

**Files:**
- Modify: `server/services/agent-learning.ts`
- Modify: `server/api/chat/stream.post.ts`
- Modify: `server/api/agent/sleep.post.ts`
- Modify: `server/api/agent/core.get.ts`
- Test: `server/services/agent-learning.test.ts`
- Test: `server/api/chat.post.test.ts`

**Step 1: Add scheduling helper**

In `server/services/agent-learning.ts`, add:

```ts
export function shouldScheduleAgentSleep(input: {
  lastSleepAt?: string | null
  nextSleepAt?: string | null
  now: string
  newConversationCount: number
}) {
  // true if no nextSleepAt or now >= nextSleepAt and there is new content
}
```

Add:

```ts
export function calculateNextSleepAt(now: string) {
  // now + 12 hours for MVP
}
```

**Step 2: Write tests**

Cover:

- no previous sleep -> schedule
- next sleep in future -> do not schedule
- next sleep passed and new content exists -> schedule

**Step 3: Update chat completion**

After successful assistant message save in `server/api/chat/stream.post.ts`:

- Load agent state.
- If `shouldScheduleAgentSleep`, set `nextSleepAt`.
- Do not call MiniMax sleep automatically.

**Step 4: Clear or advance schedule after sleep**

After manual sleep completes:

- `lastSleepAt = now`
- `nextSleepAt = calculateNextSleepAt(now)`

**Step 5: Surface readiness**

In `/api/agent/core`, include:

```ts
sleep.ready: boolean
```

**Step 6: Run tests**

Run:

```bash
npm run test -- server/services/agent-learning.test.ts server/api/chat.post.test.ts server/api/agent.core.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add server/services/agent-learning.ts server/api/chat/stream.post.ts server/api/agent/sleep.post.ts server/api/agent/core.get.ts server/services/agent-learning.test.ts server/api/chat.post.test.ts server/api/agent.core.test.ts
git commit -m "feat: schedule agent sleep reminders"
```

---

### Task 5: Add Memory Source And Governance History

**Problem:** Memory actions exist, but the user cannot inspect source conversation, source attachment, or governance history.

**Files:**
- Modify: `server/api/agent/core.get.ts`
- Modify: `server/db/sqlite.ts`
- Modify: `components/MemoryPlanetPanel.vue`
- Modify: `components/MemoryPlanetPanel.test.ts`
- Modify: `composables/useAgentCore.ts`
- Test: `server/api/agent.core.test.ts`
- Test: `server/db/sqlite.test.ts`

**Step 1: Add memory source data to Agent Core**

Extend memory summaries:

```ts
{
  id,
  type,
  content,
  importance,
  confidence,
  status,
  sourceConversationId,
  sourceAttachmentId,
  sourceExcerpt,
  governanceEvents
}
```

`sourceExcerpt` should be short and private-only.

**Step 2: Add repository methods**

In `createConversationRepository`:

```ts
getConversationByKey(keyId: string, id: string)
```

In `createMemoryEventRepository`:

```ts
listMemoryEventsByKey(keyId)
```

These may already exist partly. Fill only missing methods.

**Step 3: Write tests**

In `server/api/agent.core.test.ts`, assert selected memory includes:

- source id
- short source excerpt
- governance event action

**Step 4: Render in memory detail**

In `MemoryPlanetPanel.vue`, selected memory detail shows:

- 来源
- 置信度
- 最近治理动作
- 状态

Keep raw full conversation hidden unless the current private route explicitly needs it. Use excerpt.

**Step 5: Run tests**

Run:

```bash
npm run test -- server/api/agent.core.test.ts server/db/sqlite.test.ts components/MemoryPlanetPanel.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/api/agent/core.get.ts server/db/sqlite.ts composables/useAgentCore.ts components/MemoryPlanetPanel.vue components/MemoryPlanetPanel.test.ts server/api/agent.core.test.ts server/db/sqlite.test.ts
git commit -m "feat: show memory source and governance history"
```

---

### Task 6: Prevent Rejected Memory Relearning

**Problem:** Rejected memories should not be repeatedly recreated by future learning.

**Files:**
- Modify: `server/services/memory.ts`
- Modify: `server/services/agent-learning.ts`
- Modify: `server/api/chat/stream.post.ts`
- Test: `server/services/memory.test.ts`
- Test: `server/services/agent-learning.test.ts`

**Step 1: Add similarity guard**

In `server/services/memory.ts`, add:

```ts
export function isSimilarRejectedMemory(candidate: string, rejected: string[]) {
  // MVP: normalized substring or high token overlap.
}
```

No embeddings in this phase.

**Step 2: Write tests**

Cover:

- exact repeated rejected content returns true
- close substring returns true
- unrelated content returns false

**Step 3: Pass rejected memories into learning parser**

In `runAgentLearning`, pass existing rejected memories to normalization.

If a learned candidate is similar to rejected memory, drop it.

**Step 4: Update sleep parsing if needed**

Sleep memory actions must not re-propose confirmed rejected facts as new memories.

**Step 5: Run tests**

Run:

```bash
npm run test -- server/services/memory.test.ts server/services/agent-learning.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/services/memory.ts server/services/agent-learning.ts server/api/chat/stream.post.ts server/services/memory.test.ts server/services/agent-learning.test.ts
git commit -m "feat: prevent rejected memory relearning"
```

---

### Task 7: Add Works Detail And Preview

**Problem:** Works are stored and listed, but the user cannot inspect them as real artifacts.

**Files:**
- Modify: `server/api/agent/works.get.ts`
- Modify: `components/MemoryPlanetPanel.vue`
- Modify: `components/MemoryPlanetPanel.test.ts`
- Modify: `composables/useAgentCore.ts`
- Modify: `assets/css/main.css`
- Test: `server/api/agent.works.test.ts`

**Step 1: Extend work response**

Return:

```ts
{
  id,
  type,
  title,
  summary,
  previewUrl,
  visibility,
  sourceConversationId,
  sourceDesignVersion,
  createdAt,
  payload
}
```

Only private `/api/agent/works` may return payload.

**Step 2: Add selected work state**

In `MemoryPlanetPanel.vue`:

- clicking a work selects it
- detail area shows preview
- image shows `<img>`
- music/audio shows `<audio>`
- video shows `<video>`
- page design shows title/summary and schema title if available

**Step 3: Add filters**

Add compact type filters:

- 全部
- 图片
- 音乐
- 视频
- 页面
- 文字

**Step 4: Write tests**

Component test should cover:

- work selection
- image preview
- public/private toggle
- filter by type

**Step 5: Run tests**

Run:

```bash
npm run test -- server/api/agent.works.test.ts components/MemoryPlanetPanel.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/api/agent/works.get.ts composables/useAgentCore.ts components/MemoryPlanetPanel.vue components/MemoryPlanetPanel.test.ts assets/css/main.css server/api/agent.works.test.ts
git commit -m "feat: add agent work details"
```

---

### Task 8: Upgrade Timeline From List To Growth Timeline

**Problem:** Timeline is currently a flat list. It should show growth phases and link back to memory/proposal/work details.

**Files:**
- Modify: `server/api/agent/timeline.get.ts`
- Modify: `server/api/agent.timeline.test.ts`
- Modify: `components/MemoryPlanetPanel.vue`
- Modify: `components/MemoryPlanetPanel.test.ts`
- Modify: `assets/css/main.css`

**Step 1: Add timeline metadata**

Extend `AgentTimelineItem`:

```ts
{
  id,
  type,
  title,
  summary,
  createdAt,
  targetId?: string,
  targetType?: 'memory' | 'proposal' | 'sleep' | 'work' | 'design',
  importance?: 'normal' | 'high'
}
```

**Step 2: Group timeline by day**

API response:

```ts
{
  groups: Array<{
    date: string
    items: AgentTimelineItem[]
  }>
}
```

Keep `items` temporarily for backward compatibility if needed.

**Step 3: Render grouped timeline**

In `MemoryPlanetPanel.vue`, timeline view shows:

- date group
- event type label
- title
- summary
- high-signal visual marker

Clicking a memory/work/proposal event should switch to the matching panel detail when local data is available.

**Step 4: Run tests**

Run:

```bash
npm run test -- server/api/agent.timeline.test.ts components/MemoryPlanetPanel.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add server/api/agent/timeline.get.ts server/api/agent.timeline.test.ts components/MemoryPlanetPanel.vue components/MemoryPlanetPanel.test.ts assets/css/main.css
git commit -m "feat: add grouped agent growth timeline"
```

---

### Task 9: Add Public Agent Cards And Public Work Cards

**Problem:** Public universe only shows public work counts. It needs explicit public agent cards and public work cards without leaking private data.

**Files:**
- Modify: `server/api/public-stars.get.ts`
- Modify: `server/api/public-stars.get.test.ts`
- Modify: `components/PublicStarHome.client.vue`
- Modify: `components/PublicStarHome.test.ts`
- Modify: `utils/public-star-scene.ts`
- Modify: `utils/public-star-scene.test.ts`
- Modify: `assets/css/main.css`

**Step 1: Extend public mapper tests**

Assert public response includes only:

- id
- name
- mbti
- createdAt
- activity kind
- public works with id/type/title/summary

Assert it does not include:

- payloadJson
- previewUrl when data URL
- sourceConversationId
- private memory content
- key lookup hash

**Step 2: Add public cards UI**

In `PublicStarHome.client.vue`, add a compact public panel:

```text
公开星球
  月光 / INFJ
  公开作品 2
  - 月光图
  - 银河页面
```

Do not make this a marketing landing section. Keep it attached to the current canvas scene.

**Step 3: Show public work cards**

For public works, render:

- type
- title
- summary

No private preview unless later explicitly approved.

**Step 4: Add scene signal**

In `utils/public-star-scene.ts`, public works should affect visual intensity or satellite count.

**Step 5: Run tests**

Run:

```bash
npm run test -- server/api/public-stars.get.test.ts components/PublicStarHome.test.ts utils/public-star-scene.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/api/public-stars.get.ts server/api/public-stars.get.test.ts components/PublicStarHome.client.vue components/PublicStarHome.test.ts utils/public-star-scene.ts utils/public-star-scene.test.ts assets/css/main.css
git commit -m "feat: add public agent cards"
```

---

### Task 10: Add Proposal Rollback And Failure UX

**Problem:** Proposals write snapshots, but users cannot rollback applied changes from the UI.

**Files:**
- Modify: `server/db/sqlite.ts`
- Create: `server/api/agent/snapshots/[id]/restore.post.ts`
- Modify: `server/api/agent/core.get.ts`
- Modify: `components/AgentCorePanel.vue`
- Modify: `components/AgentCorePanel.test.ts`
- Test: `server/api/agent.core.test.ts`

**Step 1: Add snapshot restore helper test**

In `server/api/agent.core.test.ts`, add:

```ts
it('restores agent state from a snapshot', () => {
  const updateAgentState = vi.fn()
  const result = restoreAgentSnapshotAction({
    keyId: 'key_1',
    snapshotId: 'snap_1',
    snapshots: {
      getSnapshotByKey: () => ({
        id: 'snap_1',
        keyId: 'key_1',
        proposalId: 'p1',
        profileJson: JSON.stringify({
          agentState: {
            tone: '克制、温柔、安静',
            relationshipRole: '记忆星球守护者',
            learningMode: 'assisted',
            contentStrategy: {},
          },
        }),
        createdAt: '2026-05-18T00:00:00.000Z',
      }),
    },
    states: { updateAgentState },
    now: '2026-05-18T00:01:00.000Z',
  })

  expect(result.restored).toBe(true)
})
```

Expected: FAIL.

**Step 2: Store full agent state in future snapshots**

Update proposal application snapshot payload:

```json
{
  "profile": {},
  "agentState": {},
  "acceptedProposal": {}
}
```

Keep backward compatibility for old snapshots.

**Step 3: Add restore API**

Create `server/api/agent/snapshots/[id]/restore.post.ts`.

Behavior:

- Require key.
- Load snapshot by key.
- Parse `agentState`.
- Update `agent_states`.
- Return restored state.

**Step 4: Surface snapshots in Agent Core**

In `/api/agent/core`, include recent snapshots:

```ts
snapshots: Array<{ id, proposalId, createdAt }>
```

**Step 5: Render rollback action**

In `AgentCorePanel.vue`, under evolution history:

- show `回滚` for applied proposals with snapshot
- call restore API
- reload core

**Step 6: Run tests**

Run:

```bash
npm run test -- server/api/agent.core.test.ts components/AgentCorePanel.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add server/db/sqlite.ts server/api/agent/snapshots/[id]/restore.post.ts server/api/agent/core.get.ts components/AgentCorePanel.vue components/AgentCorePanel.test.ts server/api/agent.core.test.ts
git commit -m "feat: add agent evolution rollback"
```

---

### Task 11: Add Learning Quality Governance

**Problem:** Learning can write memories and proposals, but quality controls are still thin.

**Files:**
- Modify: `server/services/agent-learning.ts`
- Modify: `server/services/memory.ts`
- Modify: `server/api/chat/stream.post.ts`
- Test: `server/services/agent-learning.test.ts`
- Test: `server/services/memory.test.ts`

**Step 1: Add confidence staging rule**

Memory candidates:

- `confidence >= 0.75` and `importance >= 0.5` -> active
- `confidence < 0.75` -> archived or ignored for MVP
- rejected-similar -> ignored

**Step 2: Add conflict detector**

In `server/services/memory.ts`:

```ts
export function detectMemoryConflict(candidate: string, activeMemories: string[]) {
  // MVP: simple contradiction markers, same subject with opposite preference words.
}
```

Return a conflict reason, not a hard model decision.

**Step 3: Use conflicts to create proposals, not memories**

If a candidate conflicts:

- do not add memory directly
- create a `content_strategy` or `memory_weight` proposal only if parse result already contains one
- otherwise drop candidate

**Step 4: Add tests**

Cover:

- low confidence memory ignored
- rejected duplicate ignored
- conflict candidate not persisted
- normal memory still persisted

**Step 5: Run tests**

Run:

```bash
npm run test -- server/services/agent-learning.test.ts server/services/memory.test.ts server/api/chat.post.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add server/services/agent-learning.ts server/services/memory.ts server/api/chat/stream.post.ts server/services/agent-learning.test.ts server/services/memory.test.ts server/api/chat.post.test.ts
git commit -m "feat: add learning quality governance"
```

---

### Task 12: Full Product Verification

**Files:**
- Modify only failing files.
- Modify: `tests/e2e/main-flow.spec.ts` if new UI needs coverage.

**Step 1: Extend e2e**

Cover:

1. standalone Agent Core opens
2. page design proposal generates preview
3. sleep report shows summary, work idea, next hint
4. memory detail shows source and governance history
5. rejected memory does not reappear after learning mock
6. works detail opens and previews an image
7. timeline shows grouped event
8. public home shows public agent card and public work card
9. rollback button restores a snapshot

**Step 2: Run focused tests**

Run:

```bash
npm run test -- server/db/sqlite.test.ts server/services/agent-learning.test.ts server/services/memory.test.ts server/api/agent.core.test.ts server/api/agent.sleep.test.ts server/api/agent.memory.test.ts server/api/agent.works.test.ts server/api/agent.timeline.test.ts server/api/chat.post.test.ts server/api/design.test.ts server/api/public-stars.get.test.ts components/AgentCorePanel.test.ts components/MemoryPlanetPanel.test.ts components/PublicStarHome.test.ts utils/public-star-scene.test.ts
```

Expected: PASS.

**Step 3: Run full test suite**

Run:

```bash
npm run test
```

Expected: PASS.

**Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

**Step 5: Run e2e**

Run:

```bash
npm run test:e2e
```

Expected: PASS.

**Step 6: Privacy inspection**

Inspect:

- `server/api/public-stars.get.ts`
- `components/PublicStarHome.client.vue`
- public response tests

Confirm public payload does not expose:

- raw key
- lookup hash
- IP hash
- session data
- conversation text
- memory content
- private work payload
- private data URL previews

**Step 7: Commit verification**

```bash
git add tests/e2e/main-flow.spec.ts
git commit -m "test: verify completed agent autonomy product loop"
```

---

## Completion Criteria

This phase is complete only when all are true:

- Current autonomy baseline is committed and verified.
- `/chat` has clear `星AI` and `记忆星球` paths.
- `page_design` proposal can generate a preview and become applied after design commit.
- Sleep report shows summary, memory actions, work ideas, and next hints.
- Memory detail shows source and governance history.
- Rejected memory is not repeatedly relearned.
- Works library supports detail, preview, filters, and visibility.
- Timeline is grouped and links to details where possible.
- Public universe shows public agent/work cards without private leakage.
- Applied evolution can be rolled back from snapshot.
- `npm run test`, `npm run build`, and `npm run test:e2e` pass.

