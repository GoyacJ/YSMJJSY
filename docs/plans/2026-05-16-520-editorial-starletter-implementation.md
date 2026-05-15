# 520 Editorial Starletter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the existing Nuxt 520 app into an editorial letter-to-star-map experience while preserving unlock, MiniMax chat, media generation, quota, and multimodal input behavior.

**Architecture:** Keep the current Nuxt/Vue structure. Redesign by replacing card-heavy scene markup and CSS with envelope, editorial letter, Pretext-driven text flow, star-coordinate memories, and a lighter star-chat overlay. API routes and MiniMax service logic should not change.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, CSS, `@chenglou/pretext`, Canvas, Vitest, Playwright.

---

### Task 1: Lock Down Redesign Content Shape

**Files:**
- Modify: `content/letter.ts`
- Modify: `content/letter.test.ts`

**Step 1: Write the failing test**

Add assertions that paragraph layouts support the editorial layouts:

```ts
expect(letterParagraphs.some(item => item.layout === 'moon-wrap')).toBe(true)
expect(letterParagraphs.some(item => item.layout === 'date-orbit')).toBe(true)
expect(letterParagraphs.some(item => item.layout === 'star-trail')).toBe(true)
expect(memoryMoments.length).toBeGreaterThanOrEqual(3)
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- content/letter.test.ts
```

Expected: FAIL because the new layout values do not exist yet.

**Step 3: Update content types and data**

Change `LetterParagraph.layout` to:

```ts
layout?: 'normal' | 'moon-wrap' | 'date-orbit' | 'star-trail'
```

Update paragraph data so the letter has one normal opener and three special layouts.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -- content/letter.test.ts
```

Expected: PASS.

**Checkpoint**

Append:

```markdown
### Checkpoint: Editorial Content Shape

- Added editorial paragraph layout names.
- Updated letter content tests for Pretext-backed layouts.
- Verification: `npm run test -- content/letter.test.ts`
```

to `docs/plans/2026-05-15-520-nuxt-minimax-implementation.md`.

---

### Task 2: Build Real Pretext Line Layout

**Files:**
- Modify: `components/PretextParagraph.client.vue`
- Modify: `assets/css/main.css`

**Step 1: Write the failing test**

No unit test is required for Pretext internals because it depends on browser canvas and layout. The verification target is browser rendering plus no build errors.

**Step 2: Implement client-side line layout**

In `PretextParagraph.client.vue`, import:

```ts
import {
  layoutNextLineRange,
  materializeLineRange,
  prepareWithSegments,
  type LayoutCursor,
} from '@chenglou/pretext'
```

Use `onMounted`, `onBeforeUnmount`, `ref`, and `computed` to:

- measure the host width
- prepare the paragraph once per text/font/layout
- lay out lines with variable widths
- rerender on resize

For each layout:

- `normal`: fixed width lines.
- `moon-wrap`: narrower lines while line y overlaps the moon shape.
- `date-orbit`: indent lines around the date stamp.
- `star-trail`: gradually reduce and then restore line width.

Render lines as:

```vue
<span
  v-for="(line, index) in lines"
  :key="`${paragraph.id}-${index}`"
  class="pretext-paragraph__line"
  :style="{ marginLeft: `${line.x}px`, maxWidth: `${line.width}px` }"
>
  {{ line.text }}
</span>
```

Keep fallback plain text for very narrow widths or if Pretext throws.

**Step 3: Add CSS**

Add styles for:

- `.pretext-paragraph__line`
- `.pretext-paragraph__orb`
- `.pretext-paragraph[data-layout='moon-wrap']`
- `.pretext-paragraph[data-layout='date-orbit']`
- `.pretext-paragraph[data-layout='star-trail']`

Use named fonts in CSS and Pretext font strings. Do not use `system-ui` for Pretext measurement.

**Step 4: Verify**

Run:

```bash
npm run build
```

Expected: PASS.

**Checkpoint**

Append:

```markdown
### Checkpoint: Real Pretext Layout

- Replaced placeholder Pretext paragraph rendering with client-side line layout.
- Added moon, date, and star-trail text flow variants.
- Verification: `npm run build`
```

to `docs/plans/2026-05-15-520-nuxt-minimax-implementation.md`.

---

### Task 3: Redesign Unlock And Letter Scenes

**Files:**
- Modify: `components/UnlockGate.vue`
- Modify: `components/LetterScene.vue`
- Modify: `components/UnlockGate.test.ts`
- Modify: `assets/css/main.css`

**Step 1: Update tests**

Keep behavior assertions:

- correct code emits `unlocked`
- wrong code shows error

Add a structural assertion that unlock renders the envelope container:

```ts
expect(wrapper.find('.unlock-gate__envelope').exists()).toBe(true)
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- components/UnlockGate.test.ts
```

Expected: FAIL because the envelope container does not exist yet.

**Step 3: Update unlock markup**

Replace `.unlock-gate__paper` with an envelope composition:

- `.unlock-gate__envelope`
- `.unlock-gate__flap`
- `.unlock-gate__stamp`
- `.unlock-gate__code-line`

Keep the same form submission logic and accessible label.

**Step 4: Update letter markup**

Replace the single card feel with:

- `.letter-scene__sheet`
- `.letter-scene__folio`
- `.letter-scene__mark`
- `.letter-scene__star-map`

Memory moments should render as star-coordinate notes instead of left-border articles.

**Step 5: Update CSS**

Remove the shared heavy card styling between unlock and letter.
Use restrained paper texture, fine borders, fold lines, and asymmetric spacing.

**Step 6: Verify**

Run:

```bash
npm run test -- components/UnlockGate.test.ts
npm run build
```

Expected: PASS.

**Checkpoint**

Append:

```markdown
### Checkpoint: Envelope And Editorial Letter

- Reworked unlock into an envelope-style gate.
- Reworked the letter scene into editorial sheets and star-coordinate memories.
- Verification: `npm run test -- components/UnlockGate.test.ts`; `npm run build`
```

to `docs/plans/2026-05-15-520-nuxt-minimax-implementation.md`.

---

### Task 4: Add Letter-To-Star Transition Polish

**Files:**
- Modify: `components/LetterScene.vue`
- Modify: `components/StarScene.client.vue`
- Modify: `assets/css/main.css`

**Step 1: Add transition hooks**

Add lightweight visual elements:

- paper-edge stars in `LetterScene`
- matching star field entry styles in `StarScene`

Do not add new app state unless needed.

**Step 2: Respect reduced motion**

All transition animations must be disabled or reduced under:

```css
@media (prefers-reduced-motion: reduce)
```

**Step 3: Verify**

Run:

```bash
npm run build
```

Expected: PASS.

**Checkpoint**

Append:

```markdown
### Checkpoint: Letter To Star Transition

- Added restrained paper-to-starry-scene transition polish.
- Preserved reduced-motion behavior.
- Verification: `npm run build`
```

to `docs/plans/2026-05-15-520-nuxt-minimax-implementation.md`.

---

### Task 5: Redesign Star Chat And Quota Status

**Files:**
- Modify: `components/StarChat.vue`
- Modify: `components/StarChat.test.ts`
- Modify: `components/MiniMaxQuotaPanel.vue`
- Modify: `components/MiniMaxQuotaPanel.test.ts`
- Modify: `assets/css/main.css`

**Step 1: Update quota test**

Change the test to expect compact status text instead of a full quota list layout:

```ts
expect(wrapper.text()).toContain('星能量')
expect(wrapper.text()).toContain('语音')
expect(wrapper.text()).toContain('图像')
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- components/MiniMaxQuotaPanel.test.ts
```

Expected: FAIL because the compact status row is not implemented.

**Step 3: Update quota component**

Render a compact status row:

```text
星能量：语音 12/20 · 图像 8/10 · 音乐 3/5 · 视频暂不可用
```

Keep refresh button behavior.
Keep unavailable video visible.

**Step 4: Update StarChat markup and CSS**

Keep current behavior:

- text chat
- speech input
- image input
- image preview
- media generation panel

Change visual structure to:

- `.star-chat__note`
- `.star-chat__thread`
- `.star-chat__composer`
- `.star-chat__icon-button`

Use icon-like short controls if no icon library is present.

**Step 5: Verify**

Run:

```bash
npm run test -- components/StarChat.test.ts components/MiniMaxQuotaPanel.test.ts
npm run build
```

Expected: PASS.

**Checkpoint**

Append:

```markdown
### Checkpoint: Star Chat Visual Redesign

- Reworked StarChat as a night-note overlay while preserving text, voice, image, and media creation behavior.
- Reworked MiniMax quota as a compact star-energy status row.
- Verification: `npm run test -- components/StarChat.test.ts components/MiniMaxQuotaPanel.test.ts`; `npm run build`
```

to `docs/plans/2026-05-15-520-nuxt-minimax-implementation.md`.

---

### Task 6: Browser Verification

**Files:**
- Modify only if verification finds defects.

**Step 1: Run unit and build checks**

Run:

```bash
npm run test
npm run build
```

Expected: PASS.

**Step 2: Run Playwright**

Run:

```bash
npx playwright test
```

Expected: PASS.

**Step 3: Manual browser checks**

Open:

```text
http://127.0.0.1:3000/
```

Verify:

- unlock screen is envelope-like
- `100522` enters the letter scene
- Pretext paragraphs do not overflow on desktop
- memory moments read as star-coordinate notes
- star scene renders nonblank canvas
- star chat still supports text input
- voice and image controls remain visible
- quota row does not dominate the interface
- mobile viewport has no text overlap

**Checkpoint**

Append:

```markdown
### Checkpoint: Editorial Starletter Verification

- Ran full unit, build, and Playwright verification.
- Checked unlock, letter, Pretext flow, star scene, StarChat, and quota row in browser.
- Verification: `npm run test`; `npm run build`; `npx playwright test`
```

to `docs/plans/2026-05-15-520-nuxt-minimax-implementation.md`.
