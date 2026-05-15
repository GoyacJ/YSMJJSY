# 520 Nuxt MiniMax Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Nuxt full-stack 520 confession app with a password gate, letter-to-starry-scene experience, MiniMax-powered chat, media generation, and restrained emotional memory.

**Architecture:** Nuxt owns both UI and server APIs. Browser-only visual pieces use `.client.vue` and `<ClientOnly>`, while MiniMax calls, session validation, memory extraction, media task state, and SQLite access stay in `server/`.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Nuxt server routes, Nitro, SQLite with `better-sqlite3`, MiniMax API, Nuxt UI or shadcn-vue, Tailwind CSS, VueUse Motion, Canvas, `@chenglou/pretext`, Vitest, Playwright.

---

### Task 1: Scaffold Nuxt App

**Files:**
- Create: `package.json`
- Create: `nuxt.config.ts`
- Create: `tsconfig.json`
- Create: `app.vue`
- Create: `pages/index.vue`
- Create: `assets/css/main.css`
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: Create project files**

Use Nuxt with TypeScript.
Keep one page only.
Do not add routing beyond `pages/index.vue`.

**Step 2: Add dependencies**

Run:

```bash
npm install nuxt vue
npm install @nuxt/ui @vueuse/motion @chenglou/pretext better-sqlite3 zod nanoid
npm install -D typescript vitest @vue/test-utils @nuxt/test-utils playwright @types/better-sqlite3
```

**Step 3: Add scripts**

`package.json`:

```json
{
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "preview": "nuxt preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "check": "npm run test && npm run build"
  }
}
```

**Step 4: Configure Nuxt**

`nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@vueuse/motion/nuxt'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    minimaxApiKey: '',
    minimaxGroupId: '',
    unlockCode: '',
    sessionSecret: '',
    sqlitePath: './data/app.sqlite',
    public: {
      appName: '给你的信',
    },
  },
})
```

**Step 5: Add env example**

`.env.example`:

```text
NUXT_MINIMAX_API_KEY=
NUXT_MINIMAX_GROUP_ID=
NUXT_UNLOCK_CODE=100522
NUXT_SESSION_SECRET=change-me
NUXT_SQLITE_PATH=./data/app.sqlite
```

**Step 6: Verify scaffold**

Run:

```bash
npm run build
```

Expected:

- Nuxt build succeeds.
- `.output/` is generated.

**Step 7: Commit**

```bash
git add package.json package-lock.json nuxt.config.ts tsconfig.json app.vue pages assets .gitignore .env.example
git commit -m "chore: scaffold nuxt app"
```

---

### Task 2: Add Letter Content And Persona

### Checkpoint: Task 1

Status: completed.

Implemented:

- Scaffolded Nuxt 4 app.
- Added runtime config placeholders for MiniMax, unlock code, session secret, and SQLite path.
- Added Tailwind CSS through `@tailwindcss/vite`.
- Added initial single-page letter shell.
- Installed planned dependencies.

Verification:

```bash
npm run build
```

Result: passed.

Note:

- `@nuxt/ui` is installed but not enabled in `nuxt.config.ts` yet. Enabling it caused production build to wait on Google font/icon metadata requests. The project currently uses custom CSS and Tailwind utilities; Nuxt UI can be enabled later only if configured to avoid remote font/icon fetches.

**Files:**
- Create: `content/letter.ts`
- Create: `content/persona.ts`
- Create: `content/letter.test.ts`

**Step 1: Write content tests**

```ts
import { finalConfession, letterParagraphs, memoryMoments } from './letter'
import { starLetterPersona } from './persona'

describe('letter content', () => {
  it('keeps the letter concise', () => {
    expect(letterParagraphs.length).toBeGreaterThanOrEqual(4)
    expect(letterParagraphs.every((item) => item.text.length <= 120)).toBe(true)
  })

  it('keeps memory moments small', () => {
    expect(memoryMoments.length).toBeGreaterThanOrEqual(3)
    expect(memoryMoments.length).toBeLessThanOrEqual(5)
  })

  it('defines a final confession', () => {
    expect(finalConfession.title).toContain('喜欢')
  })

  it('sets a restrained persona', () => {
    expect(starLetterPersona).toContain('不强迫')
    expect(starLetterPersona).toContain('克制')
  })
})
```

**Step 2: Run test and verify failure**

Run:

```bash
npm run test -- content/letter.test.ts
```

Expected:

- FAIL because content files do not exist.

**Step 3: Implement `content/letter.ts`**

Use short placeholder content.
Keep all real copy replaceable in this file.

**Step 4: Implement `content/persona.ts`**

Persona must say:

- 你是“星信”
- 温柔、克制、真诚
- 不强迫对方回应
- 不做情感操控
- 只保存对方主动表达的偏好和情绪

**Step 5: Run test**

Run:

```bash
npm run test -- content/letter.test.ts
```

Expected:

- PASS.

**Step 6: Commit**

```bash
git add content
git commit -m "feat: add letter content and persona"
```

---

### Task 3: Add Session Unlock

### Checkpoint: Task 2

Status: completed.

Implemented:

- Added replaceable local letter content.
- Added memory moments.
- Added final confession copy.
- Added restrained “星信” persona.
- Added content tests.

Verification:

```bash
npm run test -- content/letter.test.ts
npm run build
```

Result: passed.

**Files:**
- Create: `server/services/session.ts`
- Create: `server/services/session.test.ts`
- Create: `server/api/unlock.post.ts`
- Create: `server/middleware/session.ts`
- Create: `composables/useUnlock.ts`

**Step 1: Write service tests**

```ts
import { isValidUnlockCode } from './session'

describe('session service', () => {
  it('accepts the configured unlock code', () => {
    expect(isValidUnlockCode('100522', '100522')).toBe(true)
  })

  it('rejects other codes', () => {
    expect(isValidUnlockCode('000000', '100522')).toBe(false)
  })
})
```

**Step 2: Run test and verify failure**

Run:

```bash
npm run test -- server/services/session.test.ts
```

Expected:

- FAIL because service does not exist.

**Step 3: Implement session helpers**

`server/services/session.ts` exports:

```ts
export function isValidUnlockCode(input: string, expected: string) {
  return input.trim() === expected
}

export function getSessionCookieName() {
  return 'letter_session'
}
```

**Step 4: Implement `/api/unlock`**

Use `readBody`, `useRuntimeConfig`, `setCookie`.
On success:

- `httpOnly: true`
- `sameSite: 'lax'`
- `secure: process.env.NODE_ENV === 'production'`
- `maxAge: 60 * 60 * 12`

On failure:

- throw 401

**Step 5: Implement middleware**

`server/middleware/session.ts` should:

- skip `/api/unlock`
- skip non-API paths
- reject `/api/*` when cookie is missing

**Step 6: Run tests and build**

Run:

```bash
npm run test -- server/services/session.test.ts
npm run build
```

Expected:

- PASS.
- Build succeeds.

**Step 7: Commit**

```bash
git add server/services/session.ts server/services/session.test.ts server/api/unlock.post.ts server/middleware/session.ts composables/useUnlock.ts
git commit -m "feat: add unlock session gate"
```

---

### Task 4: Add SQLite Storage

### Checkpoint: Task 3

Status: completed.

Implemented:

- Added unlock code validation service.
- Added `/api/unlock`.
- Added httpOnly session cookie.
- Added API session middleware for `/api/*`.
- Added `useUnlock` composable.

Verification:

```bash
npm run test -- server/services/session.test.ts
npm run build
```

Result: passed.

Note:

- Session token is intentionally simple for the first version. It protects the MiniMax proxy from casual direct browser access, but it is not a full account system.

**Files:**
- Create: `server/db/schema.ts`
- Create: `server/db/sqlite.ts`
- Create: `server/db/sqlite.test.ts`

**Step 1: Write database tests**

```ts
import { createMemoryRepository } from './sqlite'

describe('sqlite repositories', () => {
  it('stores and reads memories', () => {
    const repo = createMemoryRepository(':memory:')

    repo.addMemory({
      id: 'm1',
      type: 'emotion',
      content: '她喜欢星空部分',
      importance: 0.8,
      createdAt: '2026-05-15T00:00:00.000Z',
    })

    expect(repo.listMemories()).toHaveLength(1)
  })
})
```

**Step 2: Run test and verify failure**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected:

- FAIL because database module does not exist.

**Step 3: Implement schema**

Tables:

- `conversations`
- `memories`
- `media_tasks`

**Step 4: Implement repositories**

Keep exports small:

- `createConversationRepository(path)`
- `createMemoryRepository(path)`
- `createMediaTaskRepository(path)`

Each repository initializes schema when opened.

**Step 5: Run test**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected:

- PASS.

**Step 6: Commit**

```bash
git add server/db
git commit -m "feat: add sqlite storage"
```

---

### Task 5: Add Memory Filtering

### Checkpoint: Task 4

Status: completed.

Implemented:

- Added SQLite schema for conversations, memories, and media tasks.
- Added conversation, memory, and media task repositories.
- Added directory creation for file-backed SQLite paths.
- Added in-memory repository test.

Verification:

```bash
npm run test -- server/db/sqlite.test.ts
npm run build
```

Result: passed.

**Files:**
- Create: `server/services/memory.ts`
- Create: `server/services/memory.test.ts`
- Create: `server/api/memory.get.ts`

**Step 1: Write memory filter tests**

```ts
import { shouldPersistMemory } from './memory'

describe('memory filtering', () => {
  it('keeps explicit high-importance memories', () => {
    expect(shouldPersistMemory({
      shouldRemember: true,
      type: 'emotion',
      content: '她说她喜欢安静的星空',
      importance: 0.8,
    })).toBe(true)
  })

  it('rejects low-importance memories', () => {
    expect(shouldPersistMemory({
      shouldRemember: true,
      type: 'emotion',
      content: '普通寒暄',
      importance: 0.2,
    })).toBe(false)
  })

  it('rejects inferred romantic status', () => {
    expect(shouldPersistMemory({
      shouldRemember: true,
      type: 'emotion',
      content: '她一定已经喜欢用户',
      importance: 0.9,
    })).toBe(false)
  })
})
```

**Step 2: Run test and verify failure**

Run:

```bash
npm run test -- server/services/memory.test.ts
```

Expected:

- FAIL because service does not exist.

**Step 3: Implement memory filtering**

Rules:

- `shouldRemember` must be true
- `importance >= 0.5`
- content is not empty
- type is `emotion` or `preference`
- reject content containing strong inference patterns like `一定`, `肯定`, `已经喜欢`

**Step 4: Implement `/api/memory`**

Return saved memories.
Do not return conversation rows.

**Step 5: Run tests**

Run:

```bash
npm run test -- server/services/memory.test.ts
npm run build
```

Expected:

- PASS.
- Build succeeds.

**Step 6: Commit**

```bash
git add server/services/memory.ts server/services/memory.test.ts server/api/memory.get.ts
git commit -m "feat: add emotional memory filtering"
```

---

### Task 6: Add MiniMax Service

### Checkpoint: Task 5

Status: completed.

Implemented:

- Added memory filtering rules.
- Added inference-pattern rejection.
- Added memory type normalization.
- Added `/api/memory` read endpoint.

Verification:

```bash
npm run test -- server/services/memory.test.ts
npm run build
```

Result: passed.

**Files:**
- Create: `server/services/minimax.ts`
- Create: `server/services/minimax.test.ts`

**Step 1: Write client tests**

```ts
import { createMiniMaxClient, MiniMaxError } from './minimax'

describe('minimax client', () => {
  it('adds bearer auth to requests', async () => {
    const calls: HeadersInit[] = []
    const client = createMiniMaxClient({
      apiKey: 'key',
      groupId: 'group',
      fetcher: async (_url, init) => {
        calls.push(init?.headers ?? {})
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
    })

    await client.request('/test', { method: 'POST', body: {} })

    expect(JSON.stringify(calls[0])).toContain('Bearer key')
  })

  it('wraps upstream failures', async () => {
    const client = createMiniMaxClient({
      apiKey: 'key',
      groupId: 'group',
      fetcher: async () => new Response('bad', { status: 500 }),
    })

    await expect(client.request('/test', { method: 'POST', body: {} })).rejects.toBeInstanceOf(MiniMaxError)
  })
})
```

**Step 2: Run test and verify failure**

Run:

```bash
npm run test -- server/services/minimax.test.ts
```

Expected:

- FAIL because service does not exist.

**Step 3: Implement MiniMax client**

Expose methods:

- `chat(messages)`
- `extractMemory(messages)`
- `textToSpeech(text)`
- `generateImage(prompt)`
- `createVideoTask(prompt)`
- `getVideoTask(taskId)`
- `generateMusic(prompt)`

Keep actual API paths in this file only.
Do not let UI code know MiniMax response shape.

**Step 4: Add response mapping**

Convert provider responses into app types:

```ts
type ChatResult = { reply: string }
type AudioResult = { url?: string; base64?: string }
type ImageResult = { url: string }
type VideoTaskResult = { providerTaskId: string }
type VideoStatusResult = { status: 'pending' | 'processing' | 'succeeded' | 'failed'; url?: string }
type MusicResult = { url?: string; base64?: string }
```

**Step 5: Run tests**

Run:

```bash
npm run test -- server/services/minimax.test.ts
npm run build
```

Expected:

- PASS.
- Build succeeds.

**Step 6: Commit**

```bash
git add server/services/minimax.ts server/services/minimax.test.ts
git commit -m "feat: add minimax service client"
```

---

### Task 7: Add Chat API

### Checkpoint: Task 6

Status: completed.

Implemented:

- Added MiniMax service client.
- Added bearer authorization and optional group id header.
- Added normalized response types for chat, TTS, image, video, and music.
- Added upstream error wrapper.
- Added client tests.

Verification:

```bash
npm run test -- server/services/minimax.test.ts
npm run build
```

Result: passed.

Note:

- MiniMax endpoint paths are isolated in `server/services/minimax.ts`. If MiniMax changes a path or response shape, only this service should need updates.

**Files:**
- Create: `server/api/chat.post.ts`
- Create: `server/api/chat.post.test.ts`

**Step 1: Write handler-level test**

Test the message-building helper, not the whole Nuxt server route.
Extract helper if needed:

```ts
import { buildStarChatMessages } from './chat.post'

describe('chat api helpers', () => {
  it('includes persona, letter, memories, and user message', () => {
    const messages = buildStarChatMessages({
      userMessage: '这封信是真的吗？',
      memories: ['她喜欢星空'],
      recentConversation: [],
    })

    expect(JSON.stringify(messages)).toContain('星信')
    expect(JSON.stringify(messages)).toContain('这封信是真的吗')
    expect(JSON.stringify(messages)).toContain('她喜欢星空')
  })
})
```

**Step 2: Run test and verify failure**

Run:

```bash
npm run test -- server/api/chat.post.test.ts
```

Expected:

- FAIL because route does not exist.

**Step 3: Implement `/api/chat`**

Flow:

1. validate body with zod
2. load recent conversation
3. load memories
4. build messages
5. call MiniMax chat
6. save user and assistant messages
7. trigger memory extraction
8. return reply

Do not accept system prompt from client.

**Step 4: Implement memory extraction call**

After reply:

- call MiniMax with extraction prompt
- parse JSON defensively
- filter with `shouldPersistMemory`
- save allowed memory

If extraction fails, chat still succeeds.

**Step 5: Run tests and build**

Run:

```bash
npm run test -- server/api/chat.post.test.ts server/services/memory.test.ts
npm run build
```

Expected:

- PASS.
- Build succeeds.

**Step 6: Commit**

```bash
git add server/api/chat.post.ts server/api/chat.post.test.ts
git commit -m "feat: add star letter chat api"
```

---

### Task 8: Add Media APIs

### Checkpoint: Task 7

Status: completed.

Implemented:

- Added `/api/chat`.
- Added `buildStarChatMessages` helper.
- Included persona, letter context, saved memories, recent conversation, and current user message.
- Saved user and assistant turns to SQLite.
- Added best-effort memory extraction after replies.
- Kept memory extraction failure from breaking chat.

Verification:

```bash
npm run test -- server/api/chat.post.test.ts server/services/memory.test.ts
npm run build
```

Result: passed.

Note:

- `chat.post.ts` explicitly imports `h3` helpers so its pure helper can be imported by Vitest without relying on Nuxt auto-import globals.

**Files:**
- Create: `server/api/tts.post.ts`
- Create: `server/api/image.post.ts`
- Create: `server/api/music.post.ts`
- Create: `server/api/video/tasks.post.ts`
- Create: `server/api/video/tasks/[id].get.ts`
- Create: `server/api/media.test.ts`

**Step 1: Write media helper tests**

```ts
import { normalizeMediaPrompt, toVideoTaskStatus } from './media.test-helpers'

describe('media api helpers', () => {
  it('adds the visual style boundary to image prompts', () => {
    expect(normalizeMediaPrompt('画一张星空')).toContain('温柔')
  })

  it('maps provider video status', () => {
    expect(toVideoTaskStatus('Success')).toBe('succeeded')
    expect(toVideoTaskStatus('Fail')).toBe('failed')
  })
})
```

If helpers should not live inside API route files, create `server/services/media.ts`.

**Step 2: Run test and verify failure**

Run:

```bash
npm run test -- server/api/media.test.ts
```

Expected:

- FAIL because helpers do not exist.

**Step 3: Implement TTS route**

`POST /api/tts`

- body: `{ text }`
- max text length: 500
- return normalized audio result

**Step 4: Implement image route**

`POST /api/image`

- body: `{ prompt }`
- add fixed style boundary
- return image URL

**Step 5: Implement music route**

`POST /api/music`

- body: `{ prompt? }`
- default style: gentle piano, light strings, slow, starry
- return audio result

**Step 6: Implement video task routes**

`POST /api/video/tasks`

- create app `media_tasks` row
- call MiniMax create video task
- save provider task id
- return app task id

`GET /api/video/tasks/:id`

- load app task
- query provider task if not done
- update row
- return normalized status

**Step 7: Run tests and build**

Run:

```bash
npm run test -- server/api/media.test.ts
npm run build
```

Expected:

- PASS.
- Build succeeds.

**Step 8: Commit**

```bash
git add server/api server/services/media.ts
git commit -m "feat: add minimax media APIs"
```

---

### Task 9: Build Unlock And Letter UI

**Files:**
- Create: `components/UnlockGate.vue`
- Create: `components/LetterScene.vue`
- Create: `components/PretextParagraph.client.vue`
- Create: `components/UnlockGate.test.ts`
- Modify: `pages/index.vue`
- Modify: `assets/css/main.css`

**Step 1: Write component tests**

```ts
import { mount } from '@vue/test-utils'
import UnlockGate from './UnlockGate.vue'

describe('UnlockGate', () => {
  it('emits unlocked after successful submit', async () => {
    const wrapper = mount(UnlockGate, {
      props: {
        unlock: async () => ({ ok: true }),
      },
    })

    await wrapper.find('input').setValue('100522')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.emitted('unlocked')).toBeTruthy()
  })
})
```

**Step 2: Run test and verify failure**

Run:

```bash
npm run test -- components/UnlockGate.test.ts
```

Expected:

- FAIL because component does not exist.

**Step 3: Implement `UnlockGate`**

UI:

- centered sealed letter
- password input
- button text: `打开这封信`
- error text: `这不是这封信的钥匙。`

**Step 4: Implement `LetterScene`**

Render:

- letter paragraphs
- memory moments
- quiet motion

Use `PretextParagraph.client.vue` only for special layouts.

**Step 5: Wire `pages/index.vue`**

State:

- locked
- reading
- star
- chat

Start locked.
Unlock moves to reading.

**Step 6: Run tests and build**

Run:

```bash
npm run test -- components/UnlockGate.test.ts
npm run build
```

Expected:

- PASS.
- Build succeeds.

**Step 7: Commit**

```bash
git add components/UnlockGate.vue components/LetterScene.vue components/PretextParagraph.client.vue components/UnlockGate.test.ts pages/index.vue assets/css/main.css
git commit -m "feat: add unlock and letter UI"
```

---

### Task 10: Build Star Scene

**Files:**
- Create: `components/StarScene.client.vue`
- Create: `server/utils/star-map.ts`
- Create: `server/utils/star-map.test.ts`
- Modify: `pages/index.vue`

**Step 1: Write star map test**

```ts
import { create520StarPoints } from './star-map'

describe('create520StarPoints', () => {
  it('creates deterministic points inside bounds', () => {
    const points = create520StarPoints({ width: 800, height: 600 })

    expect(points.length).toBeGreaterThan(20)
    expect(points.every((point) => point.x >= 0 && point.x <= 800)).toBe(true)
    expect(points.every((point) => point.y >= 0 && point.y <= 600)).toBe(true)
  })
})
```

**Step 2: Run test and verify failure**

Run:

```bash
npm run test -- server/utils/star-map.test.ts
```

Expected:

- FAIL because helper does not exist.

**Step 3: Implement star map helper**

Keep it pure.
Do not use browser APIs.

**Step 4: Implement `StarScene.client.vue`**

Requirements:

- full viewport star scene
- Canvas only on client
- high-DPI support
- resize support
- cancel animation on unmount
- reduced motion fallback

**Step 5: Wire scene transition**

After letter reading reaches the end, show `StarScene`.

**Step 6: Run tests and build**

Run:

```bash
npm run test -- server/utils/star-map.test.ts
npm run build
```

Expected:

- PASS.
- Build succeeds.

**Step 7: Commit**

```bash
git add components/StarScene.client.vue server/utils/star-map.ts server/utils/star-map.test.ts pages/index.vue
git commit -m "feat: add starry finale scene"
```

---

### Task 11: Build Star Chat UI

**Files:**
- Create: `components/StarChat.vue`
- Create: `components/StarChat.test.ts`
- Create: `composables/useStarChat.ts`
- Modify: `pages/index.vue`

**Step 1: Write component test**

```ts
import { mount } from '@vue/test-utils'
import StarChat from './StarChat.vue'

describe('StarChat', () => {
  it('sends user message and renders reply', async () => {
    const wrapper = mount(StarChat, {
      props: {
        sendMessage: async () => ({ reply: '这封信是真的。' }),
      },
    })

    await wrapper.find('textarea').setValue('这封信是真的吗？')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('这封信是真的')
  })
})
```

**Step 2: Run test and verify failure**

Run:

```bash
npm run test -- components/StarChat.test.ts
```

Expected:

- FAIL because component does not exist.

**Step 3: Implement `useStarChat`**

Use `$fetch('/api/chat')`.
Track:

- messages
- pending
- error

**Step 4: Implement `StarChat`**

UI:

- lightweight floating panel
- title: `星信`
- textarea
- send button
- calm loading state
- no assistant avatar clutter

**Step 5: Wire into star scene**

After final confession, show StarChat entry.

**Step 6: Run tests and build**

Run:

```bash
npm run test -- components/StarChat.test.ts
npm run build
```

Expected:

- PASS.
- Build succeeds.

**Step 7: Commit**

```bash
git add components/StarChat.vue components/StarChat.test.ts composables/useStarChat.ts pages/index.vue
git commit -m "feat: add star letter chat UI"
```

---

### Task 12: Build Media Creation UI

**Files:**
- Create: `components/MediaCreationPanel.vue`
- Create: `components/GeneratedAsset.vue`
- Create: `components/MediaCreationPanel.test.ts`
- Create: `composables/useMediaTasks.ts`
- Modify: `components/StarChat.vue`

**Step 1: Write component test**

```ts
import { mount } from '@vue/test-utils'
import MediaCreationPanel from './MediaCreationPanel.vue'

describe('MediaCreationPanel', () => {
  it('shows four media actions', () => {
    const wrapper = mount(MediaCreationPanel)

    expect(wrapper.text()).toContain('听一听')
    expect(wrapper.text()).toContain('画一张')
    expect(wrapper.text()).toContain('做一段')
    expect(wrapper.text()).toContain('写一首')
  })
})
```

**Step 2: Run test and verify failure**

Run:

```bash
npm run test -- components/MediaCreationPanel.test.ts
```

Expected:

- FAIL because component does not exist.

**Step 3: Implement `useMediaTasks`**

Expose:

- `createSpeech(text)`
- `createImage(prompt)`
- `createVideo(prompt)`
- `pollVideoTask(id)`
- `createMusic(prompt)`

**Step 4: Implement panel**

Four actions:

- 听一听
- 画一张
- 做一段
- 写一首

Do not auto-generate media.
Only generate after explicit click.

**Step 5: Implement `GeneratedAsset`**

Render:

- audio
- image
- video
- pending state
- failed state

**Step 6: Run tests and build**

Run:

```bash
npm run test -- components/MediaCreationPanel.test.ts
npm run build
```

Expected:

- PASS.
- Build succeeds.

**Step 7: Commit**

```bash
git add components/MediaCreationPanel.vue components/GeneratedAsset.vue components/MediaCreationPanel.test.ts composables/useMediaTasks.ts components/StarChat.vue
git commit -m "feat: add media creation panel"
```

---

### Task 13: Add E2E Smoke Tests

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/main-flow.spec.ts`

**Step 1: Add Playwright config**

Use Nuxt dev server:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
```

**Step 2: Add smoke test**

Test:

- wrong password shows gentle error
- `100522` unlocks
- letter appears
- star scene appears
- chat panel can be opened

Mock `/api/chat` with Playwright route.

**Step 3: Run E2E**

Run:

```bash
npx playwright test
```

Expected:

- PASS on desktop and mobile project.

**Step 4: Commit**

```bash
git add playwright.config.ts tests/e2e
git commit -m "test: add main flow e2e coverage"
```

---

### Task 14: Add Deployment Docs

**Files:**
- Create: `README.md`
- Create: `docs/deployment.md`

**Step 1: Document local setup**

Include:

```bash
npm install
cp .env.example .env
npm run dev
```

**Step 2: Document production build**

Include:

```bash
npm run build
node .output/server/index.mjs
```

**Step 3: Document VPS deployment**

Include:

- Node.js runtime
- Nginx reverse proxy
- HTTPS
- `NUXT_*` env vars
- SQLite file path
- backup note for `data/app.sqlite`

**Step 4: Verify docs commands**

Run:

```bash
npm run build
```

Expected:

- PASS.

**Step 5: Commit**

```bash
git add README.md docs/deployment.md
git commit -m "docs: add nuxt deployment guide"
```

---

### Task 15: Final Verification And Review

**Files:**
- Review all changed files.

**Step 1: Run full verification**

Run:

```bash
npm run test
npm run build
npx playwright test
```

Expected:

- All pass.

**Step 2: Run code review**

Use `/code-review-expert`.

Focus:

- API Key never leaks to client
- `/api/*` session gate works
- MiniMax errors are normalized
- memory filtering rejects inference
- Canvas cleanup works
- mobile layout does not overflow

**Step 3: Run security review**

Use `/security-review`.

This is required because the project now includes:

- user input
- API proxy
- cookies
- model calls
- persistent memory

**Step 4: Commit fixes**

Only if fixes are made:

```bash
git add .
git commit -m "fix: address review feedback"
```
