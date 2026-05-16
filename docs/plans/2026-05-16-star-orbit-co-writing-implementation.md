# Star Orbit Co-writing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild `/chat` from a chat-thread visual into a star-orbit co-writing stage where each user/AI exchange forms a spatial memory star while the existing composer and MiniMax flow stay unchanged.

**Architecture:** Keep `StarChat.vue` as the state, streaming, attachment, and composer container. Replace `StarMagicStage` with a new `StarOrbitStage` that derives visual groups from existing `StarChatMessage[]`; no backend schema, API key, MiniMax route, or `StarComposer.vue` change. Media keeps the existing `StarChatPart` structure and is rendered through an orbit-specific wrapper.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript, Vitest, Vue Test Utils, Playwright, CSS in `assets/css/main.css`.

---

### Task 1: Commit Current Thinking Status Baseline

**Files:**
- Modify: `components/StarChat.vue`
- Modify: `components/StarChat.test.ts`
- Modify: `assets/css/main.css`

**Step 1: Verify current baseline**

Run:

```bash
npm run test -- components/StarChat.test.ts
```

Expected: pass, including contextual status tests.

**Step 2: Commit the baseline**

Run:

```bash
git add components/StarChat.vue components/StarChat.test.ts assets/css/main.css
git commit -m "feat: add contextual star thinking status"
```

Expected: commit succeeds.

### Task 2: Add Orbit Group Derivation

**Files:**
- Create: `components/StarOrbitStage.test.ts`
- Create: `components/StarOrbitStage.vue`

**Step 1: Write failing tests**

Create tests that mount `StarOrbitStage` with:

- one user + assistant pair.
- one user + assistant image result.
- one dangling user message.

Assertions:

- `.star-orbit-stage` exists.
- `.star-orbit-group` count matches user messages.
- first group contains user text and assistant text.
- media group receives `data-mood="nebula"` when assistant has image/audio/music/video.
- memory button label is derived from the user message.

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- components/StarOrbitStage.test.ts
```

Expected: fail because `StarOrbitStage.vue` does not exist.

**Step 3: Implement minimal `StarOrbitStage.vue`**

Implementation requirements:

- Accept `messages: StarChatMessage[]` and `activeMessageIndex: number | null`.
- Emit `copy`, `activate`, and `interact`.
- Derive `groups` in a computed property by pairing each user message with the following assistant message.
- Generate stable positions from group index with bounded percentages.
- Compute `mood` from assistant media parts and reply length.
- Render memory buttons as real `button` elements.
- Render a popover when a memory button is clicked.

**Step 4: Run focused test**

Run:

```bash
npm run test -- components/StarOrbitStage.test.ts
```

Expected: pass.

### Task 3: Add Orbit Media Wrapper

**Files:**
- Create: `components/StarSpectralMedia.vue`
- Create: `components/StarSpectralMedia.test.ts`
- Modify: `components/StarOrbitStage.vue`

**Step 1: Write failing tests**

Create tests for:

- image part renders a shard with download link.
- audio and music parts render existing `StarAudioPlayer`.
- video part renders video with controls.

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- components/StarSpectralMedia.test.ts
```

Expected: fail because component does not exist.

**Step 3: Implement wrapper**

Implementation requirements:

- Reuse source resolution from `StarMediaCard`.
- Use `StarAudioPlayer` for audio/music.
- Use orbit classes: `.star-spectral-media`, `.star-spectral-media__shard`, `.star-spectral-media__actions`.
- Keep download support.

**Step 4: Use it in `StarOrbitStage.vue`**

Replace media rendering inside orbit groups with `StarSpectralMedia`.

**Step 5: Run focused tests**

Run:

```bash
npm run test -- components/StarSpectralMedia.test.ts components/StarOrbitStage.test.ts
```

Expected: pass.

### Task 4: Switch Chat Stage

**Files:**
- Modify: `components/StarChat.vue`
- Modify: `components/StarChat.test.ts`
- Modify: `tests/e2e/main-flow.spec.ts`

**Step 1: Update tests**

In `StarChat.test.ts`, change stage expectations from `.star-magic-stage` / `.star-chat__thread` to `.star-orbit-stage`.

In `main-flow.spec.ts`, expect:

```ts
await expect(page.locator('.star-orbit-stage')).toBeVisible()
await expect(page.locator('.star-orbit-group')).toHaveCountGreaterThan(0)
```

Keep existing composer, attachment, design mode, media generation, and history assertions.

**Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- components/StarChat.test.ts
```

Expected: fail until `StarChat.vue` imports the new stage.

**Step 3: Replace stage import**

In `components/StarChat.vue`:

- replace `StarMagicStage` import with `StarOrbitStage`.
- replace template usage.
- keep `messagesThreadRef` because scroll handling still targets the stage root.
- keep all composer and stream logic unchanged.

**Step 4: Run focused tests**

Run:

```bash
npm run test -- components/StarChat.test.ts components/StarOrbitStage.test.ts
```

Expected: pass.

### Task 5: Style Orbit Stage

**Files:**
- Modify: `assets/css/main.css`

**Step 1: Add layout CSS**

Add classes for:

- `.star-orbit-stage`
- `.star-orbit-stage__field`
- `.star-orbit-stage__path`
- `.star-orbit-group`
- `.star-orbit-group__user`
- `.star-orbit-group__assistant`
- `.star-orbit-group__core`
- `.star-memory-constellation`
- `.star-memory-popover`
- `.star-spectral-media`

Requirements:

- transparent stage.
- readable text in dark and light mode.
- no traditional chat bubble border.
- latest group remains visible near bottom center.
- mobile layout switches to vertical orbit.
- reduced motion disables drift/fly animations.

**Step 2: Run build**

Run:

```bash
npm run build
```

Expected: pass with no CSS syntax errors.

### Task 6: Browser Verification

**Files:**
- No code files unless verification finds defects.

**Step 1: Run full automated checks**

Run:

```bash
npm run test
npm run build
npm run test:e2e
```

Expected: all pass.

**Step 2: Start local server**

Run:

```bash
npm run dev -- --host 127.0.0.1 --port 3010
```

Expected: server starts.

**Step 3: Inspect in browser**

Open:

```text
http://127.0.0.1:3010/chat
```

Check:

- orbit stage is visible.
- sending text creates star trail group.
- AI reply appears in same group.
- memory star opens recap.
- media result appears inside orbit group.
- desktop and mobile do not overlap the composer.

**Step 4: Commit**

Run:

```bash
git add docs/plans/2026-05-16-star-orbit-co-writing-design.md docs/plans/2026-05-16-star-orbit-co-writing-implementation.md components/StarOrbitStage.vue components/StarOrbitStage.test.ts components/StarSpectralMedia.vue components/StarSpectralMedia.test.ts components/StarChat.vue components/StarChat.test.ts assets/css/main.css tests/e2e/main-flow.spec.ts
git commit -m "feat: add star orbit co-writing stage"
```

Expected: commit succeeds.

---

## Checkpoint 2026-05-16

已完成 Task 1 到 Task 6。

提交：

- `5a63263 feat: add contextual star thinking status`

实现：

- `/chat` 舞台切换为 `StarOrbitStage`。
- 新增星轨归组、月相 mood、记忆星、记忆回看浮层。
- 新增 `StarSpectralMedia`，媒体资源在星轨舞台内展示并保留下载。
- `StarComposer.vue`、MiniMax API、钥匙体系、后端持久化未改动。

验证：

- `npm run test`：35 个测试文件通过，140 个测试通过。
- `npm run build`：通过；仍有 Nuxt/Tailwind sourcemap 既有警告。
- `npm run test:e2e`：chromium 和 mobile 通过。
- Playwright 浏览器脚本检查桌面和移动端布局，星轨组、记忆回看、图片媒体恢复可见，未压住发送框。
