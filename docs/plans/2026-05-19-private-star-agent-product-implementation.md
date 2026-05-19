# Private Star Agent Product Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current star chat and Agent OS prototype into a private star agent product with unified IA, user-facing boundaries, governed memory, private works, records, and AI disclosure.

**Architecture:** Keep the existing Nuxt 4, Vue 3, Nitro, SQLite, and Agent OS layering. Add a thin product shell first, then move user-facing language and policy behavior behind existing services. Avoid rewriting core Agent runtime; use service tests to lock policy, memory, works, and publishing behavior.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript, Nitro server routes, better-sqlite3, Zod, Vitest, Vue Test Utils, Playwright, Tailwind/CSS.

---

## Execution Rules

- Start from the current dirty tree carefully. Do not revert unrelated changes.
- Work in small commits.
- Use TDD for service behavior.
- For UI-only copy/layout changes, use component tests or browser verification.
- Keep existing routes compatible.
- Do not expose private memory, raw chat text, session data, key hashes, IP hashes, or raw model payloads.
- Any publishing, persona change, sensitive memory write, or destructive action must remain approval-gated.
- After any code change, run focused tests first, then `npm run check` before final handoff.

## Baseline Check

Run:

```bash
git status --short
npm run test
npm run build
```

Expected:

- Dirty files are known and not overwritten.
- Existing tests pass, or existing failures are documented before feature work.
- Build passes, or existing build failure is documented.

---

## Phase 1: Unified Star Planet Shell

### Task 1: Add Product Shell Component

**Files:**

- Create: `components/StarPlanetPanel.vue`
- Modify: `pages/chat.vue`
- Test: `components/StarPlanetPanel.test.ts` if component test setup exists; otherwise verify with Playwright.

**Goal:** Replace separate visible entries for memory, settings, and Agent Core with one user-facing `星球` entry.

**Implementation:**

- Add `StarPlanetPanel.vue`.
- Props should accept the same data/actions already passed to `MemoryPlanetPanel`, `AgentCorePanel`, and `ProfileSettingsSheet`.
- Internal tabs:
  - `memory`
  - `works`
  - `boundaries`
  - `records`
- Display labels:
  - `记忆`
  - `作品`
  - `边界`
  - `记录`
- Keep existing components mounted through the shell where possible.
- Do not remove old components until the shell is stable.

**Verification:**

```bash
npm run build
```

Browser checks:

- `/chat` desktop: only one `星球` entry is visible.
- `/chat` mobile: panel opens, closes, and tabs switch.
- Existing memory and Agent actions still load.

**Commit:**

```bash
git add components/StarPlanetPanel.vue pages/chat.vue
git commit -m "feat: unify star planet panel entry"
```

### Task 2: Convert Engineering Labels To Product Labels

**Files:**

- Modify: `components/AgentCorePanel.vue`
- Modify: `components/MemoryPlanetPanel.vue`
- Modify: `components/StarPlanetPanel.vue`

**Goal:** Remove engineering-facing labels from user-visible UI.

**Mapping:**

- `星AI` -> `待确认`
- `任务中心` -> `行动`
- `审计事件` -> `记录`
- `睡眠周期` -> `整理报告`
- `待确认进化` -> `待确认调整`
- `Agent Core` -> do not display
- `Agent OS` -> do not display
- `active · star` -> do not display

**Verification:**

Run:

```bash
rg "Agent Core|Agent OS|任务中心|审计事件|睡眠周期|active · star" components pages
npm run build
```

Expected:

- No user-visible engineering labels remain in component templates.
- Build passes.

**Commit:**

```bash
git add components/AgentCorePanel.vue components/MemoryPlanetPanel.vue components/StarPlanetPanel.vue
git commit -m "refactor: use product language for agent controls"
```

---

## Phase 2: Home And Setup Repositioning

### Task 3: Reposition Home Copy

**Files:**

- Modify: `components/PublicStarHome.client.vue`
- Modify: `pages/index.vue` if copy is defined there.

**Goal:** Keep the existing visual identity but reposition the product from confession page to private star entry.

**Copy Direction:**

- Keep `余生梦见皆是缘`.
- Use supporting copy around private star, memory, works, and boundaries.
- Avoid wording that implies AI is a real person.
- Keep key entry behavior unchanged.

**Verification:**

Browser checks:

- `/` desktop: key input and actions are still visible.
- `/` mobile: copy does not overflow.
- Existing unlock flow still works.

**Commit:**

```bash
git add components/PublicStarHome.client.vue pages/index.vue
git commit -m "copy: reposition home as private star entry"
```

### Task 4: Extend Setup With Boundary Fields

**Files:**

- Modify: `pages/setup.vue`
- Modify: `components/KeySetupPanel.vue`
- Modify: `server/api/keys.post.ts`
- Modify: `server/db/schema.ts`
- Modify: `server/db/sqlite.ts`
- Test: `server/db/sqlite.test.ts`
- Test: `server/api/keys.post.test.ts` if present; otherwise add focused API test near existing key tests.

**Goal:** Capture user boundary settings during initialization.

**Data:**

```ts
type StarBoundarySettings = {
  memoryWriteMode: 'manual' | 'assisted' | 'auto'
  generatedWorksDefaultVisibility: 'private' | 'public'
  requireApprovalForPublishing: boolean
  requireApprovalForPersonaChange: boolean
  requireApprovalForSensitiveMemory: boolean
  disallowedMemoryTopics: string[]
  allowedMemoryTopics: string[]
  minorMode: boolean
}
```

**Test First:**

- Creating a key without boundary input stores conservative defaults.
- Creating a key with boundary input persists the values.
- Invalid `memoryWriteMode` is rejected.

**Default Values:**

```ts
{
  memoryWriteMode: 'assisted',
  generatedWorksDefaultVisibility: 'private',
  requireApprovalForPublishing: true,
  requireApprovalForPersonaChange: true,
  requireApprovalForSensitiveMemory: true,
  disallowedMemoryTopics: [],
  allowedMemoryTopics: [],
  minorMode: false,
}
```

**Verification:**

```bash
npm run test -- server/db/sqlite.test.ts
npm run test -- server/api/keys.post.test.ts
npm run build
```

**Commit:**

```bash
git add pages/setup.vue components/KeySetupPanel.vue server/api/keys.post.ts server/db/schema.ts server/db/sqlite.ts server/db/sqlite.test.ts
git commit -m "feat: store star boundary settings"
```

---

## Phase 3: Policy And Privacy Behavior

### Task 5: Connect Boundary Settings To Agent Policy

**Files:**

- Modify: `server/services/agent-policy.ts`
- Modify: `server/services/agent-privacy.ts`
- Modify: `server/services/star-agent-tools.ts`
- Test: `server/services/agent-policy.test.ts`
- Test: `server/services/star-agent-tools.test.ts`

**Goal:** Make boundary settings affect actual Agent decisions.

**Rules:**

- `requireApprovalForPublishing` gates `star.publishWork`.
- `requireApprovalForPersonaChange` gates persona/tone changes.
- `requireApprovalForSensitiveMemory` gates sensitive memory writes.
- `minorMode` blocks virtual lover / virtual intimate relationship positioning.
- Disallowed topics prevent memory writes matching those topics.

**Test First:**

- Publishing requires approval by default.
- Sensitive memory requires approval by default.
- Disallowed memory topic returns `allowed: false`.
- Minor mode rejects intimate relationship persona changes.

**Verification:**

```bash
npm run test -- server/services/agent-policy.test.ts
npm run test -- server/services/star-agent-tools.test.ts
```

**Commit:**

```bash
git add server/services/agent-policy.ts server/services/agent-privacy.ts server/services/star-agent-tools.ts server/services/agent-policy.test.ts server/services/star-agent-tools.test.ts
git commit -m "feat: apply user boundaries to agent policy"
```

### Task 6: Add Boundary Tab UI

**Files:**

- Modify: `components/ProfileSettingsSheet.vue`
- Modify: `components/StarPlanetPanel.vue`
- Modify: `composables/useKeyDesign.ts` or create a focused composable only if existing composables cannot carry the data.
- Modify: relevant API route for profile/settings update.

**Goal:** Let users inspect and update boundaries after setup.

**UI Fields:**

- 记忆写入方式。
- 作品默认私密。
- 公开前确认。
- 人格调整前确认。
- 敏感记忆前确认。
- 不允许记住的内容。
- 允许记住的内容。
- 未成年人模式。

**Verification:**

- Updating a field persists after reload.
- Invalid values show existing error style.
- Mobile view remains usable.

**Commit:**

```bash
git add components/ProfileSettingsSheet.vue components/StarPlanetPanel.vue composables server/api
git commit -m "feat: expose star boundary controls"
```

---

## Phase 4: Memory Governance Productization

### Task 7: Require Confirmation For Sensitive Long-Term Memory

**Files:**

- Modify: `server/services/agent-learning.ts`
- Modify: `server/services/memory.ts`
- Modify: `server/services/agent-task-intents.ts`
- Test: `server/services/agent-learning.test.ts`
- Test: `server/services/memory.test.ts`

**Goal:** Prevent sensitive memory from silently entering active long-term memory.

**Behavior:**

- Normal memory follows `memoryWriteMode`.
- Sensitive memory becomes pending confirmation when `requireApprovalForSensitiveMemory` is true.
- Rejected memory cannot be recreated by sleep consolidation without new user evidence.

**Verification:**

```bash
npm run test -- server/services/agent-learning.test.ts
npm run test -- server/services/memory.test.ts
```

**Commit:**

```bash
git add server/services/agent-learning.ts server/services/memory.ts server/services/agent-task-intents.ts server/services/agent-learning.test.ts server/services/memory.test.ts
git commit -m "feat: require confirmation for sensitive memory"
```

### Task 8: Rewrite Memory Tab Around Governance

**Files:**

- Modify: `components/MemoryPlanetPanel.vue`
- Modify: `components/StarMemoryMap.vue`
- Modify: `utils/memory-planet.ts`

**Goal:** Make memory understandable and controllable.

**UI Requirements:**

- Show type, confidence, importance, status.
- Show source when available.
- Show latest governance event.
- Actions: confirm, archive, reject.
- Use `删除` only when actual deletion exists; otherwise use `归档` or `拒绝`.

**Verification:**

- Existing memory star view still renders.
- Governance buttons call existing action handlers.
- Empty state is short and not explanatory.

**Commit:**

```bash
git add components/MemoryPlanetPanel.vue components/StarMemoryMap.vue utils/memory-planet.ts
git commit -m "feat: make memory governance user-facing"
```

---

## Phase 5: Works And AI Disclosure

### Task 9: Add AI Disclosure Metadata To Works

**Files:**

- Modify: `types/design-schema.ts`
- Modify: `server/services/design-schema.ts`
- Modify: `server/services/design-commit.ts`
- Modify: `server/services/blob-storage.ts`
- Test: `server/services/design-schema.test.ts`
- Test: `server/services/design-commit.test.ts`
- Test: `server/services/blob-storage.test.ts`

**Goal:** Store AI-generated disclosure metadata for generated works.

**Data:**

```ts
type GeneratedContentDisclosure = {
  aiGenerated: true
  explicitLabel: string
  provider?: string
  generatedAt: string
  sourceWorkId?: string
}
```

**Rules:**

- Generated text, image, audio, video, and page design works get `aiGenerated: true`.
- Public works must expose a visible disclosure label.
- Private works still store metadata.

**Verification:**

```bash
npm run test -- server/services/design-schema.test.ts
npm run test -- server/services/design-commit.test.ts
npm run test -- server/services/blob-storage.test.ts
```

**Commit:**

```bash
git add types/design-schema.ts server/services/design-schema.ts server/services/design-commit.ts server/services/blob-storage.ts server/services/*.test.ts
git commit -m "feat: record ai disclosure metadata for works"
```

### Task 10: Productize Works Tab

**Files:**

- Modify: `components/MemoryPlanetPanel.vue`
- Modify: `components/GeneratedAsset.vue`
- Modify: `components/DesignPreviewSheet.vue`
- Modify: `components/StarMediaCard.vue`

**Goal:** Make generated works feel like a private library, not attachments.

**UI Requirements:**

- Default label: `私密`.
- Public label: `已公开`.
- Visible AI label on generated works.
- Publishing requires confirmation.
- Revoking public visibility remains available.

**Verification:**

- Work cards render disclosure.
- Public/private toggle still calls API.
- No generated work appears public by default.

**Commit:**

```bash
git add components/MemoryPlanetPanel.vue components/GeneratedAsset.vue components/DesignPreviewSheet.vue components/StarMediaCard.vue
git commit -m "feat: show private works and ai disclosure"
```

---

## Phase 6: Records And Reports

### Task 11: Convert Sleep Output To Organizing Report

**Files:**

- Modify: `server/services/agent-sleep.ts`
- Modify: `server/services/agent-events.ts`
- Test: `server/services/agent-sleep.test.ts` if present; otherwise add one.
- Test: `server/services/agent-events.test.ts`

**Goal:** Treat sleep runs as user-facing organizing reports.

**Report Sections:**

- 新记忆
- 合并建议
- 删除建议
- 行动建议
- 作品建议

**Rules:**

- Report does not directly mutate sensitive memory.
- Report items can become inbox actions.
- Rejected suggestions should not repeat without new evidence.

**Verification:**

```bash
npm run test -- server/services/agent-sleep.test.ts
npm run test -- server/services/agent-events.test.ts
```

**Commit:**

```bash
git add server/services/agent-sleep.ts server/services/agent-events.ts server/services/agent-sleep.test.ts server/services/agent-events.test.ts
git commit -m "feat: expose sleep runs as organizing reports"
```

### Task 12: Build Records Tab From Existing Events

**Files:**

- Modify: `components/AgentCorePanel.vue`
- Modify: `components/StarPlanetPanel.vue`
- Modify: `composables/useAgentOs.ts`
- Modify: `server/api/agents/current/os.get.ts`

**Goal:** Replace audit-event UX with a readable record stream.

**Record Types:**

- 记忆
- 行动
- 作品
- 发布
- 整理
- 失败

**Verification:**

- Existing OS events still load.
- Records show short title, summary, time, status.
- Raw payloads are not exposed.

**Commit:**

```bash
git add components/AgentCorePanel.vue components/StarPlanetPanel.vue composables/useAgentOs.ts server/api/agents/current/os.get.ts
git commit -m "feat: show agent records as product timeline"
```

---

## Phase 7: Browser Verification And Regression

### Task 13: Add Or Update E2E Coverage

**Files:**

- Modify: existing Playwright tests under `tests/` if present.
- Create: `tests/star-planet.spec.ts` if no matching E2E file exists.

**Scenarios:**

- Home loads and unlock flow still works.
- Chat loads after unlock.
- Star planet panel opens.
- Tabs switch: memory, works, boundaries, records.
- Publishing is not automatic.
- Boundary tab persists a changed setting.

**Run:**

```bash
npm run test:e2e
```

**Commit:**

```bash
git add tests
git commit -m "test: cover star planet product flow"
```

### Task 14: Final Verification

Run:

```bash
npm run test
npm run build
npm run test:e2e
```

Manual browser checks:

- `/`
- `/setup`
- `/chat`
- `/chat` mobile viewport
- Star planet panel desktop
- Star planet panel mobile
- Memory governance
- Works visibility
- Boundary settings
- Records tab

Expected:

- Tests pass.
- Build passes.
- No private data leaks in UI payloads.
- No high-risk action bypasses approval.
- No user-visible `Agent Core`, `Agent OS`, `任务中心`, `审计事件`, `睡眠周期`.

**Commit:**

```bash
git status --short
git commit -m "chore: verify private star agent product flow"
```

Only create the final commit if there are verification-only changes.

---

## Suggested Delivery Order

Week 1:

- Phase 1.
- Phase 2 Task 3.

Week 2:

- Phase 2 Task 4.
- Phase 3.

Week 3:

- Phase 4.

Week 4:

- Phase 5.

Week 5:

- Phase 6.

Week 6:

- Phase 7.
- Visual polish.
- Mobile fixes.

## Review Checklist

Before merging:

- Run code review focused on privacy, policy bypass, and raw payload exposure.
- Run security review because this touches user input, memory, generated content, and publishing.
- Confirm AI disclosure appears for generated public content.
- Confirm minor mode blocks intimate-role positioning.
- Confirm rejected memory cannot silently re-enter active memory.
- Confirm public works do not expose private source memories.

