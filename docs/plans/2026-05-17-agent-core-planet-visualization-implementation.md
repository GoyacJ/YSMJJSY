# Agent Core Planet Visualization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the key agent visible as a product experience by upgrading Agent Core and adding a memory planet visualization driven by memories, reflections, and evolution proposals.

**Architecture:** Extend the existing `/api/agent/core` response, keep one source of truth for agent state, derive planet visuals on the client through a pure utility, and render two lightweight panels on `/chat`. Do not change chat generation or proposal mutation semantics.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Nitro server routes, better-sqlite3, Vitest, Vue Test Utils, Playwright, CSS.

---

### Task 1: Expand Agent Core Response

**Files:**
- Modify: `server/api/agent/core.get.ts`
- Test: `server/api/agent.core.test.ts`
- Modify: `composables/useAgentCore.ts`

**Step 1: Write failing tests**

Add tests for:

- `profile` includes `tone`, `relationshipRole`, and `learningMode`.
- response includes active memory summaries.
- response splits proposals into `pending` and `history`.
- accepted, applied, and rejected proposals appear in history.

**Step 2: Run failing tests**

Run:

```bash
npm run test -- server/api/agent.core.test.ts
```

Expected: FAIL.

**Step 3: Update response builder**

Extend `buildAgentCoreResponse` to return:

- profile defaults:
  - `tone: '克制、温柔、安静'`
  - `relationshipRole: '记忆星球守护者'`
  - `learningMode: '辅助学习'`
- `memories`
- `proposals.pending`
- `proposals.history`

Do not add a new API.

**Step 4: Update frontend type**

Update `AgentCore` in `composables/useAgentCore.ts`.

**Step 5: Run tests**

Run:

```bash
npm run test -- server/api/agent.core.test.ts
```

Expected: PASS.

---

### Task 2: Derive Memory Planet State

**Files:**
- Create: `utils/memory-planet.ts`
- Test: `utils/memory-planet.test.ts`

**Step 1: Write failing utility tests**

Cover:

- active memories become `memoryStars`.
- high-importance memories are marked bright.
- reflections become `reflectionNebulas`.
- pending proposals become `proposalLights`.
- accepted/applied proposals become `orbitRings`.
- rejected proposals do not become main visual nodes.
- empty input returns an empty but valid planet state.

**Step 2: Run failing tests**

Run:

```bash
npm run test -- utils/memory-planet.test.ts
```

Expected: FAIL.

**Step 3: Implement utility**

Add:

```ts
export function buildMemoryPlanetState(core: AgentCore | null): MemoryPlanetState
```

Keep it pure and deterministic.

Use stable positions from item index and id. Do not use random values.

**Step 4: Run tests**

Run:

```bash
npm run test -- utils/memory-planet.test.ts
```

Expected: PASS.

---

### Task 3: Upgrade Agent Core Panel

**Files:**
- Modify: `components/AgentCorePanel.vue`
- Test: `components/AgentCorePanel.test.ts`
- Modify: `assets/css/main.css`

**Step 1: Write failing component tests**

Cover:

- trigger text is `智能体核心` or `核心` depending on viewport-independent DOM text.
- panel shows tone, relationship role, and learning mode.
- pending proposal shows a derived “接受后” line.
- proposal history is visible.
- accept/reject still call the update action.

**Step 2: Run failing tests**

Run:

```bash
npm run test -- components/AgentCorePanel.test.ts
```

Expected: FAIL.

**Step 3: Update component**

Update panel sections:

- 当前状态
- 最近反思
- 待确认进化
- 进化历史

Add a helper for proposal payload text:

```ts
function describeProposalEffect(proposal: AgentCoreProposal) {
  // derive concise text from payload/type
}
```

**Step 4: Update CSS**

Keep styling consistent with current chat theater.

Avoid large cards inside cards.

**Step 5: Run tests**

Run:

```bash
npm run test -- components/AgentCorePanel.test.ts
```

Expected: PASS.

---

### Task 4: Build Memory Planet Components

**Files:**
- Create: `components/MemoryPlanetStage.vue`
- Create: `components/MemoryPlanetPanel.vue`
- Test: `components/MemoryPlanetPanel.test.ts`
- Modify: `assets/css/main.css`

**Step 1: Write failing component tests**

Cover:

- empty state renders.
- memory stars render as buttons with accessible labels.
- clicking a memory star shows detail.
- reflections render as decorative nebulas.
- pending proposals render as proposal lights.
- accepted/applied proposals render as orbit rings.

**Step 2: Run failing tests**

Run:

```bash
npm run test -- components/MemoryPlanetPanel.test.ts
```

Expected: FAIL.

**Step 3: Implement `MemoryPlanetStage`**

Props:

```ts
defineProps<{
  state: MemoryPlanetState
}>()
```

Events:

```ts
selectMemory: [id: string]
selectProposal: [id: string]
```

**Step 4: Implement `MemoryPlanetPanel`**

Props:

```ts
defineProps<{
  core: AgentCore | null
  open: boolean
}>()
```

Events:

```ts
close: []
```

Build state through `buildMemoryPlanetState`.

**Step 5: Add CSS**

Use DOM/CSS:

- radial planet field
- star buttons
- soft nebula spans
- orbit rings

Honor `prefers-reduced-motion`.

**Step 6: Run tests**

Run:

```bash
npm run test -- components/MemoryPlanetPanel.test.ts
```

Expected: PASS.

---

### Task 5: Rework Star Memory Entry

**Files:**
- Modify: `components/StarMemoryMap.vue`
- Test: `components/StarMemoryMap.test.ts`

**Step 1: Write failing tests**

Cover:

- button text says `记忆星球`.
- subtitle says `记忆、反思和进化轨道`.
- emits `open-planet`.
- still supports opening settings through a separate event or secondary control if needed.

**Step 2: Run failing tests**

Run:

```bash
npm run test -- components/StarMemoryMap.test.ts
```

Expected: FAIL.

**Step 3: Update component**

Change emitted event:

```ts
'open-planet': []
'open-settings': []
```

If keeping one visible button, use it for planet. Put settings in `MemoryPlanetPanel` or keep settings access from Agent Core.

**Step 4: Run tests**

Run:

```bash
npm run test -- components/StarMemoryMap.test.ts
```

Expected: PASS.

---

### Task 6: Wire Panels Into Chat Page

**Files:**
- Modify: `pages/chat.vue`
- Modify: `components/AgentCorePanel.vue`
- Modify: `components/MemoryPlanetPanel.vue`
- Test: `tests/e2e/main-flow.spec.ts`

**Step 1: Add page state**

In `pages/chat.vue`, track:

- `memoryPlanetOpen`
- shared `agentCore` state if needed

Make sure Agent Core and Memory Planet can both refresh after proposal updates.

**Step 2: Update e2e**

Add checks:

- open chat.
- open Agent Core.
- open Memory Planet.
- verify no input obstruction.

**Step 3: Run e2e**

Run:

```bash
npm run test:e2e
```

Expected: PASS.

---

### Task 7: Full Verification

**Files:**
- No new files unless a failure requires a fix.

**Step 1: Run focused tests**

Run:

```bash
npm run test -- server/api/agent.core.test.ts components/AgentCorePanel.test.ts components/MemoryPlanetPanel.test.ts utils/memory-planet.test.ts
```

Expected: PASS.

**Step 2: Run full test suite**

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

---

## Completion Criteria

- Agent Core shows current status, reflections, pending evolution, and history.
- Memory Planet visualizes memories, reflections, pending proposals, and accepted evolution.
- State comes from `/api/agent/core`.
- Proposal accept/reject refreshes visible state.
- Desktop and mobile layouts do not block chat input.
- Unit tests, build, and e2e pass.
