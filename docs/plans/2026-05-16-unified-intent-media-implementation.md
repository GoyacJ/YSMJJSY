# Unified Intent Media Chat Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make each composer send perform one primary intent, route media generation through the conversation flow, and render text/media results inside the chat thread.

**Architecture:** Keep the Nuxt app and the existing `/api/chat` endpoint. Extend chat requests with an optional intent, move media orchestration to the server, and return a structured assistant message with parts. The frontend will only render messages and select/force intent; it will no longer call `/api/image`, `/api/tts`, `/api/music`, or `/api/video/tasks` in parallel from `StarChat.vue`.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Nitro server routes, MiniMax service client, SQLite repositories, Zod, Vitest, Playwright.

---

## Product Semantics

- One send equals one primary task.
- `听一听` means: generate a StarChat text reply first, then convert that reply to speech, and show both in one assistant message.
- `画一张` means: generate an image only, and show it in the assistant message.
- `写一首` means: generate music only, and show it in the assistant message.
- `做一段` means: create/poll video generation, and show status/result in the assistant message.
- No selected intent means automatic routing.
- Manual intent selection always wins over automatic routing.
- Design mode remains separate and still emits `designRequested`.

## Intent Priority

```ts
type StarChatIntent = 'auto' | 'chat' | 'audio' | 'image' | 'music' | 'video'
```

Resolution order:

1. Forced intent from composer buttons.
2. Lightweight keyword rules.
3. Default `chat`.

Initial keyword rules:

```ts
const intentRules = [
  { intent: 'image', patterns: [/画/, /图片/, /插画/, /海报/, /生成.*图/] },
  { intent: 'music', patterns: [/歌/, /音乐/, /旋律/, /写一首/, /作曲/] },
  { intent: 'video', patterns: [/视频/, /动画/, /短片/, /做一段/] },
  { intent: 'audio', patterns: [/读给我听/, /念给我听/, /听你说/, /语音/] },
]
```

Do not add model-based intent classification in this pass. Add it later only if rules are too weak.

---

## Message Contract

Add structured message parts while keeping `reply` for compatibility during migration.

```ts
export type StarChatPart =
  | { type: 'text'; text: string }
  | { type: 'audio'; url?: string; base64?: string }
  | { type: 'image'; url?: string; base64?: string }
  | { type: 'music'; url?: string; base64?: string }
  | { type: 'video'; url?: string }
  | { type: 'status'; text: string }

export type StarChatMessage = {
  role: 'user' | 'assistant'
  content: string
  imageDataUrl?: string
  parts?: StarChatPart[]
}

export type StarChatSendPayload = {
  message: string
  attachments: StarChatAttachment[]
  intent?: StarChatIntent
}

export type StarChatReply = {
  reply: string
  message: StarChatMessage
}
```

Frontend rendering should prefer `parts`. `content` remains the text fallback for existing code and tests.

---

## Execution Rules

- Execute tasks in order with `superpowers:executing-plans`.
- Use TDD for each behavior change.
- After each task passes verification, append a checkpoint to this file.
- Do not commit `.env`, MiniMax API keys, generated `.output`, `test-results`, or local SQLite data.
- Avoid changing unrelated layout/design while implementing this flow.

---

### Task 1: Add Shared Chat Part And Intent Types

**Files:**
- Modify: `composables/useStarChat.ts`
- Test: `components/StarChat.test.ts`

**Step 1: Write failing type/behavior test**

Add a component test that stubs `sendMessage` with a structured assistant message:

```ts
it('renders structured text and audio parts in the chat thread', async () => {
  const sendMessage = vi.fn(async () => ({
    reply: '先慢慢呼吸。',
    message: {
      role: 'assistant',
      content: '先慢慢呼吸。',
      parts: [
        { type: 'text', text: '先慢慢呼吸。' },
        { type: 'audio', base64: 'abc' },
      ],
    },
  }))
  const wrapper = mountStarChat({ props: { sendMessage } })

  await wrapper.find('textarea').setValue('读给我听')
  await wrapper.find('form').trigger('submit.prevent')

  expect(wrapper.text()).toContain('先慢慢呼吸。')
  expect(wrapper.get('audio').attributes('src')).toBe('data:audio/mpeg;base64,abc')
})
```

**Step 2: Run failing test**

Run:

```bash
npm run test -- components/StarChat.test.ts
```

Expected: FAIL because `StarChat.vue` only renders `message.content`.

**Step 3: Add types**

In `composables/useStarChat.ts`, add:

```ts
export type StarChatIntent = 'auto' | 'chat' | 'audio' | 'image' | 'music' | 'video'

export type StarChatPart =
  | { type: 'text'; text: string }
  | { type: 'audio'; url?: string; base64?: string }
  | { type: 'image'; url?: string; base64?: string }
  | { type: 'music'; url?: string; base64?: string }
  | { type: 'video'; url?: string }
  | { type: 'status'; text: string }
```

Extend `StarChatMessage`, `StarChatSendPayload`, and `StarChatReply` as described in the Message Contract.

**Step 4: Keep compatibility in composable**

When `$fetch('/api/chat')` returns a result without `message`, normalize it:

```ts
const assistantMessage = result.message ?? {
  role: 'assistant',
  content: result.reply,
  parts: result.reply ? [{ type: 'text', text: result.reply }] : [],
}
```

**Step 5: Run test**

Run:

```bash
npm run test -- components/StarChat.test.ts
```

Expected: PASS.

**Checkpoint:**

Append:

```markdown
### Checkpoint: Task 1
- Added shared intent and message part types.
- Kept legacy `reply` compatibility.
- Verified with `npm run test -- components/StarChat.test.ts`.
```

---

### Task 2: Render Media Parts Inside The Chat Thread

### Checkpoint: Task 1
- Added shared intent and message part types.
- Kept legacy `reply` compatibility in both the composable and StarChat fallback path.
- Verified with `npm run test -- components/StarChat.test.ts`: 12 tests passed.

**Files:**
- Modify: `components/StarChat.vue`
- Modify: `assets/css/main.css`
- Test: `components/StarChat.test.ts`

**Step 1: Write failing render tests**

Add tests for image, music, video, and status parts:

```ts
it('renders image, music, video, and status parts in assistant messages', async () => {
  const sendMessage = vi.fn(async () => ({
    reply: '生成好了。',
    message: {
      role: 'assistant',
      content: '生成好了。',
      parts: [
        { type: 'status', text: '正在生成' },
        { type: 'image', base64: 'img' },
        { type: 'music', base64: 'song' },
        { type: 'video', url: 'https://example.com/star.mp4' },
      ],
    },
  }))
  const wrapper = mountStarChat({ props: { sendMessage } })

  await wrapper.find('textarea').setValue('画一张星空')
  await wrapper.find('form').trigger('submit.prevent')

  expect(wrapper.text()).toContain('正在生成')
  expect(wrapper.get('img[alt="生成的图片"]').attributes('src')).toBe('data:image/png;base64,img')
  expect(wrapper.get('audio[data-kind="music"]').attributes('src')).toBe('data:audio/mpeg;base64,song')
  expect(wrapper.get('video').attributes('src')).toBe('https://example.com/star.mp4')
})
```

**Step 2: Run failing test**

Run:

```bash
npm run test -- components/StarChat.test.ts
```

Expected: FAIL because media parts are not rendered.

**Step 3: Update message rendering**

In `StarChat.vue`, render:

```vue
<template v-if="message.parts?.length">
  <template v-for="(part, partIndex) in message.parts" :key="`${index}-${partIndex}`">
    <span v-if="part.type === 'text'">{{ part.text }}</span>
    <span v-else-if="part.type === 'status'" class="star-chat__message-status">{{ part.text }}</span>
    <audio
      v-else-if="part.type === 'audio' || part.type === 'music'"
      controls
      :data-kind="part.type"
      :src="part.url || (part.base64 ? `data:audio/mpeg;base64,${part.base64}` : undefined)"
    />
    <img
      v-else-if="part.type === 'image'"
      class="star-chat__message-image"
      :src="part.url || (part.base64 ? `data:image/png;base64,${part.base64}` : undefined)"
      alt="生成的图片"
    >
    <video v-else controls :src="part.url" />
  </template>
</template>
<span v-else>{{ message.content }}</span>
```

**Step 4: Style embedded media**

Add CSS for audio/video inside chat bubbles:

```css
.star-chat__messages audio,
.star-chat__messages video {
  width: min(18rem, 100%);
}

.star-chat__message-status {
  color: var(--chat-thread-ink-soft);
  font-size: 0.86rem;
}
```

**Step 5: Run test**

Run:

```bash
npm run test -- components/StarChat.test.ts
```

Expected: PASS.

**Checkpoint:**

Append task result and command output summary.

---

### Task 3: Stop Frontend Parallel Media Calls

### Checkpoint: Task 2
- Rendered structured text, audio, image, music, video, and status parts inside the chat thread.
- Added chat-thread media/status styles.
- Verified with `npm run test -- components/StarChat.test.ts`: 13 tests passed.

**Files:**
- Modify: `components/StarChat.vue`
- Modify: `components/StarChat.test.ts`
- Optionally delete later: `composables/useMediaTasks.ts` if no other component still uses it.

**Step 1: Write failing test**

Replace the current media generation test with one that verifies selecting `画一张` sends only one request through `sendMessage`:

```ts
it('sends selected media intent through the chat request only', async () => {
  const sendMessage = vi.fn(async () => ({
    reply: '画好了。',
    message: {
      role: 'assistant',
      content: '画好了。',
      parts: [{ type: 'image', url: 'https://example.com/star.png' }],
    },
  }))
  ;(globalThis as any).$fetch = vi.fn()
  const wrapper = mountStarChat({ props: { sendMessage } })

  await wrapper.get('button[aria-label="画一张"]').trigger('click')
  await wrapper.find('textarea').setValue('月光星空')
  await wrapper.find('form').trigger('submit.prevent')

  expect(sendMessage).toHaveBeenCalledWith({
    message: '月光星空',
    attachments: [],
    intent: 'image',
  })
  expect((globalThis as any).$fetch).not.toHaveBeenCalled()
})
```

**Step 2: Run failing test**

Run:

```bash
npm run test -- components/StarChat.test.ts
```

Expected: FAIL because `StarChat.vue` currently calls `createMediaAsset`.

**Step 3: Remove parallel media orchestration from `StarChat.vue`**

Remove these local states/functions/imports from `StarChat.vue`:

- `useMediaTasks`
- `GeneratedAssetItem`
- `generatedAssets`
- `pendingMediaKind`
- `addAsset`
- `updateAsset`
- `createMediaAsset`
- `<GeneratedAsset ...>`

Keep `selectedMediaKinds`, but treat it as selected intent.

**Step 4: Submit forced intent**

Map selected media to one intent:

```ts
const selectedIntent = selectedMediaKinds.value[0] ?? 'auto'
```

Send:

```ts
const payload = {
  message: text,
  attachments: selectedAttachments,
  intent: selectedIntent,
}
```

Do not call media APIs from the component.

**Step 5: Restrict to one selected intent**

Change `toggleMediaKind`:

```ts
selectedMediaKinds.value = selectedMediaKinds.value[0] === kind ? [] : [kind]
```

**Step 6: Run test**

Run:

```bash
npm run test -- components/StarChat.test.ts
```

Expected: PASS.

**Checkpoint:**

Append task result and command output summary.

---

### Task 4: Add Server Intent Resolver

### Checkpoint: Task 3
- Removed frontend media generation calls from `StarChat.vue`.
- Changed media controls to select one forced chat intent.
- Sent selected intent through the single `sendMessage` request and kept media results in chat messages.
- Verified with `npm run test -- components/StarChat.test.ts`: 13 tests passed.

**Files:**
- Create: `server/services/chat-intent.ts`
- Test: `server/services/chat-intent.test.ts`
- Modify: `server/api/chat.post.ts`

**Step 1: Write resolver tests**

Create `server/services/chat-intent.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { resolveChatIntent } from './chat-intent'

describe('resolveChatIntent', () => {
  it('keeps forced intent', () => {
    expect(resolveChatIntent({ message: '随便聊聊', forcedIntent: 'image' })).toBe('image')
  })

  it('detects image intent', () => {
    expect(resolveChatIntent({ message: '画一张月光下的信' })).toBe('image')
  })

  it('detects audio intent', () => {
    expect(resolveChatIntent({ message: '读给我听' })).toBe('audio')
  })

  it('defaults to chat', () => {
    expect(resolveChatIntent({ message: '今天有点累' })).toBe('chat')
  })
})
```

**Step 2: Run failing test**

Run:

```bash
npm run test -- server/services/chat-intent.test.ts
```

Expected: FAIL because file does not exist.

**Step 3: Implement resolver**

Create:

```ts
export type ResolvedChatIntent = 'chat' | 'audio' | 'image' | 'music' | 'video'

export function resolveChatIntent(input: {
  message: string
  forcedIntent?: 'auto' | ResolvedChatIntent
}): ResolvedChatIntent {
  if (input.forcedIntent && input.forcedIntent !== 'auto') {
    return input.forcedIntent
  }

  const message = input.message
  const rules: Array<{ intent: ResolvedChatIntent; patterns: RegExp[] }> = [
    { intent: 'image', patterns: [/画/, /图片/, /插画/, /海报/, /生成.*图/] },
    { intent: 'music', patterns: [/歌/, /音乐/, /旋律/, /写一首/, /作曲/] },
    { intent: 'video', patterns: [/视频/, /动画/, /短片/, /做一段/] },
    { intent: 'audio', patterns: [/读给我听/, /念给我听/, /听你说/, /语音/] },
  ]

  return rules.find(rule => rule.patterns.some(pattern => pattern.test(message)))?.intent ?? 'chat'
}
```

**Step 4: Extend chat body schema**

In `server/api/chat.post.ts`, accept:

```ts
intent: z.enum(['auto', 'chat', 'audio', 'image', 'music', 'video']).default('auto')
```

**Step 5: Run tests**

Run:

```bash
npm run test -- server/services/chat-intent.test.ts server/api/chat.post.test.ts
```

Expected: PASS.

**Checkpoint:**

Append task result and command output summary.

---

### Task 5: Orchestrate Chat, Audio, Image, Music, And Video In `/api/chat`

### Checkpoint: Task 4
- Added `resolveChatIntent` with forced intent priority and keyword routing.
- Extended `/api/chat` request schema with `intent`.
- Verified with `npm run test -- server/services/chat-intent.test.ts server/api/chat.post.test.ts`: 7 tests passed.

**Files:**
- Modify: `server/api/chat.post.ts`
- Modify: `server/api/chat.post.test.ts`
- Modify: `server/services/minimax.ts` only if client methods need return normalization changes.

**Step 1: Write failing API tests**

Add tests for:

- Forced `audio` calls chat first, then TTS with chat reply.
- Forced `image` does not call chat.
- Auto image intent routes to image.
- Returned payload contains `message.parts`.

Example audio expectation:

```ts
expect(client.chat).toHaveBeenCalled()
expect(client.textToSpeech).toHaveBeenCalledWith('星信回复')
expect(response.message.parts).toEqual([
  { type: 'text', text: '星信回复' },
  { type: 'audio', base64: '...' },
])
```

**Step 2: Run failing tests**

Run:

```bash
npm run test -- server/api/chat.post.test.ts
```

Expected: FAIL because `/api/chat` always only chats.

**Step 3: Implement intent branches**

After existing context/memory setup, resolve intent:

```ts
const intent = resolveChatIntent({
  message: body.data.message,
  forcedIntent: body.data.intent,
})
```

For `chat`:

```ts
const result = await client.chat(messages)
return {
  reply: result.reply,
  message: {
    role: 'assistant',
    content: result.reply,
    parts: [{ type: 'text', text: result.reply }],
  },
}
```

For `audio`:

```ts
const result = await client.chat(messages)
const audio = await client.textToSpeech(result.reply)
return {
  reply: result.reply,
  message: {
    role: 'assistant',
    content: result.reply,
    parts: [
      { type: 'text', text: result.reply },
      { type: 'audio', ...audio },
    ],
  },
}
```

For `image`:

```ts
const image = await client.generateImage(normalizeMediaPrompt(body.data.message))
return {
  reply: '画好了。',
  message: {
    role: 'assistant',
    content: '画好了。',
    parts: [
      { type: 'text', text: '画好了。' },
      { type: 'image', ...image },
    ],
  },
}
```

For `music`:

```ts
const music = await client.generateMusic(body.data.message || getDefaultMusicPrompt())
return {
  reply: '写好了。',
  message: {
    role: 'assistant',
    content: '写好了。',
    parts: [
      { type: 'text', text: '写好了。' },
      { type: 'music', ...music },
    ],
  },
}
```

For `video`, keep the existing provider flow if polling in request is acceptable. If current video can take long, return status and task id in this pass, then add polling later:

```ts
const task = await client.createVideoTask(body.data.message)
return {
  reply: '视频开始生成了。',
  message: {
    role: 'assistant',
    content: '视频开始生成了。',
    parts: [{ type: 'status', text: '视频开始生成了。' }],
  },
  taskId: task.providerTaskId,
}
```

**Step 4: Persist assistant content**

Continue storing:

```ts
content: assistantMessage.content
```

Do not store base64 media in conversation content. Existing attachment/media persistence can be revisited separately.

**Step 5: Memory extraction**

Only extract memory from text-bearing intents:

```ts
if (['chat', 'audio'].includes(intent) && body.data.message) {
  // existing extraction
}
```

**Step 6: Run tests**

Run:

```bash
npm run test -- server/api/chat.post.test.ts
```

Expected: PASS.

**Checkpoint:**

Append task result and command output summary.

---

### Task 6: Remove Or De-scope Standalone Media Panel Usage In StarChat

### Checkpoint: Task 5
- Added server-side chat intent orchestration for chat, audio, image, music, and video.
- Returned structured assistant messages from `/api/chat`.
- Limited memory extraction to text-bearing chat/audio intents.
- Verified with `npm run test -- server/services/chat-intent.test.ts server/api/chat.post.test.ts`: 10 tests passed.

**Files:**
- Modify: `components/StarChat.vue`
- Modify: `components/GeneratedAsset.vue` only if it becomes unused and tests require removal.
- Modify: `components/MediaCreationPanel.vue` only if it is no longer used anywhere.
- Test: `components/StarChat.test.ts`

**Step 1: Confirm usage**

Run:

```bash
rg -n "GeneratedAsset|MediaCreationPanel|useMediaTasks" .
```

Expected: `StarChat.vue` should no longer depend on `GeneratedAsset` or `useMediaTasks`.

**Step 2: Remove unused imports/components**

If `GeneratedAsset` is only used by old tests and old panel, keep the files but remove StarChat usage. Do not delete standalone media components unless no tests or routes use them.

**Step 3: Run tests**

Run:

```bash
npm run test -- components/StarChat.test.ts components/MediaCreationPanel.test.ts
```

Expected: PASS.

**Checkpoint:**

Append task result and command output summary.

---

### Task 7: Update End-to-End Flow

### Checkpoint: Task 6
- Confirmed `StarChat.vue` no longer uses `GeneratedAsset`, `MediaCreationPanel`, or `useMediaTasks`.
- Kept standalone media components in place because their own tests still cover them.
- Verified with `npm run test -- components/StarChat.test.ts components/MediaCreationPanel.test.ts`: 14 tests passed.

**Files:**
- Modify: `tests/e2e/main-flow.spec.ts`

**Step 1: Add route mocks**

Update the `/api/chat` mock so it can return structured messages:

```ts
await page.route('**/api/chat', async (route) => {
  const body = route.request().postDataJSON()

  if (body.intent === 'image') {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        reply: '画好了。',
        message: {
          role: 'assistant',
          content: '画好了。',
          parts: [
            { type: 'text', text: '画好了。' },
            { type: 'image', url: 'https://example.com/star.png' },
          ],
        },
      }),
    })
    return
  }

  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      reply: '这句我会记得。',
      message: {
        role: 'assistant',
        content: '这句我会记得。',
        parts: [{ type: 'text', text: '这句我会记得。' }],
      },
    }),
  })
})
```

**Step 2: Assert single-channel media behavior**

In the chat flow:

```ts
await page.getByRole('button', { name: '画一张' }).click()
await page.getByLabel('和星信说话').fill('画一张月光星空')
await page.getByLabel('和星信说话').press('Enter')
await expect(page.getByText('画好了。')).toBeVisible()
await expect(page.locator('.star-chat__messages img[alt="生成的图片"]')).toBeVisible()
```

No separate `GeneratedAsset` panel should be asserted.

**Step 3: Run E2E**

Run:

```bash
npm run test:e2e
```

Expected: PASS for desktop and mobile.

**Checkpoint:**

Append task result and command output summary.

---

### Task 8: Full Verification And Cleanup

### Checkpoint: Task 7
- Updated E2E `/api/chat` mock to return structured assistant messages.
- Added image intent flow coverage inside the chat thread.
- Disabled Nuxt DevTools in test/dev config to avoid mobile pointer interception during E2E.
- Verified with `npm run test:e2e`: 2 tests passed.

**Files:**
- Potentially all touched files.

**Step 1: Run full test suite**

Run:

```bash
npm run test
```

Expected: all tests pass.

**Step 2: Run E2E**

Run:

```bash
npm run test:e2e
```

Expected: all E2E tests pass.

**Step 3: Build**

Run:

```bash
npm run build
```

Expected: build exits 0. Existing Nuxt/Tailwind sourcemap warnings are acceptable.

**Step 4: Diff hygiene**

Run:

```bash
git diff --check
git status --short
```

Expected:

- No whitespace errors.
- No `test-results`, `.output`, local SQLite DBs, or `.env` staged/created for commit.

### Checkpoint: Task 8
- Full unit suite passed with `npm run test`: 24 files, 85 tests.
- E2E passed with `npm run test:e2e`: chromium and mobile.
- Production build passed with `npm run build`.
- Diff hygiene checked with `git diff --check`.
- Removed generated `.output` and `test-results`.
