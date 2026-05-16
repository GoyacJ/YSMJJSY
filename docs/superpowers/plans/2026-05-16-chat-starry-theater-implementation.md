# Chat Starry Theater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `/chat` from a conventional chat overlay into a polished starry theater with modular chat components, richer media rendering, a quieter composer, and a memory star-map entry.

**Architecture:** Keep `StarChat.vue` as the state container and split rendering into focused child components. Do not change MiniMax server routes, key/session behavior, or stream protocol. Use Vue props/events for boundaries and CSS custom properties for light/dark theme behavior.

**Tech Stack:** Nuxt 3, Vue 3 `<script setup>`, TypeScript, Vitest, Vue Test Utils, Playwright, CSS in `assets/css/main.css`.

---

## File Structure

- Modify `components/StarChat.vue`: keep chat orchestration, streaming, attachment reading, voice input, submit flow, and expose props/events to child components.
- Create `components/StarChatThread.vue`: render the scrollable message thread, handle message activation, and emit copy requests.
- Create `components/StarChatMessage.vue`: render one user or assistant message with text, status, media, copy action, and media download actions.
- Create `components/StarMediaCard.vue`: render image, audio, music, and video parts as starry media cards.
- Create `components/StarComposer.vue`: render the bottom composer, attachment menu, voice/design/media intent controls, and emit submit/control events.
- Create `components/StarMemoryMap.vue`: show a compact memory star-map entry and open existing settings.
- Modify `pages/chat.vue`: add starry theater shell classes and place `StarMemoryMap`.
- Modify `assets/css/main.css`: add theater background, message, media card, composer, and memory map styling.
- Modify `components/StarChat.test.ts`: update tests for component split and visual/accessibility contracts.
- Create `components/StarChatMessage.test.ts`: focused tests for message actions and media rendering.
- Create `components/StarComposer.test.ts`: focused tests for composer controls and events.
- Create `components/StarMemoryMap.test.ts`: focused tests for memory-map entry.
- Modify `tests/e2e/main-flow.spec.ts`: update selectors/placeholders while preserving full flow coverage.

---

## Task 1: Extract Message Rendering Components

**Files:**
- Create: `components/StarMediaCard.vue`
- Create: `components/StarChatMessage.vue`
- Create: `components/StarChatMessage.test.ts`
- Modify: `components/StarChat.vue`
- Modify: `components/StarChat.test.ts`

- [ ] **Step 1: Write focused message rendering tests**

Create `components/StarChatMessage.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import StarChatMessage from './StarChatMessage.vue'

describe('StarChatMessage', () => {
  it('renders assistant text with a copy action', async () => {
    const wrapper = mount(StarChatMessage, {
      props: {
        message: {
          role: 'assistant',
          content: '我还记得那片星空。',
          parts: [{ type: 'text', text: '我还记得那片星空。' }],
        },
        active: false,
      },
    })

    expect(wrapper.attributes('data-role')).toBe('assistant')
    expect(wrapper.text()).toContain('我还记得那片星空。')

    await wrapper.get('button[aria-label="复制消息"]').trigger('click')

    expect(wrapper.emitted('copy')).toEqual([[{
      role: 'assistant',
      content: '我还记得那片星空。',
      parts: [{ type: 'text', text: '我还记得那片星空。' }],
    }]])
  })

  it('renders image, audio, music, video, status, and download actions', () => {
    const wrapper = mount(StarChatMessage, {
      props: {
        message: {
          role: 'assistant',
          content: '生成好了。',
          parts: [
            { type: 'status', text: '正在生成' },
            { type: 'image', base64: 'img' },
            { type: 'audio', base64: 'audio' },
            { type: 'music', base64: 'song' },
            { type: 'video', url: 'https://example.com/star.mp4' },
          ],
        },
        active: true,
      },
    })

    expect(wrapper.text()).toContain('正在生成')
    expect(wrapper.get('img[alt="生成的图片"]').attributes('src')).toBe('data:image/png;base64,img')
    expect(wrapper.get('audio[data-kind="audio"]').attributes('src')).toBe('data:audio/mpeg;base64,audio')
    expect(wrapper.get('audio[data-kind="music"]').attributes('src')).toBe('data:audio/mpeg;base64,song')
    expect(wrapper.get('video').attributes('src')).toBe('https://example.com/star.mp4')
    expect(wrapper.get('a[download="star-image.png"]').attributes('href')).toBe('data:image/png;base64,img')
    expect(wrapper.get('a[download="star-audio.mp3"]').attributes('href')).toBe('data:audio/mpeg;base64,audio')
    expect(wrapper.get('a[download="star-music.mp3"]').attributes('href')).toBe('data:audio/mpeg;base64,song')
    expect(wrapper.get('a[download="star-video.mp4"]').attributes('href')).toBe('https://example.com/star.mp4')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test -- components/StarChatMessage.test.ts
```

Expected: fail because `components/StarChatMessage.vue` does not exist.

- [ ] **Step 3: Create `StarMediaCard.vue`**

Create `components/StarMediaCard.vue`:

```vue
<script setup lang="ts">
import type { StarChatPart } from '../composables/useStarChat'

const props = defineProps<{
  part: StarChatPart
}>()

function getMediaSource(part: StarChatPart) {
  if (!['audio', 'image', 'music', 'video'].includes(part.type)) {
    return undefined
  }

  if ('url' in part && part.url) {
    return part.url
  }

  if (!('base64' in part) || !part.base64) {
    return undefined
  }

  return part.type === 'image'
    ? `data:image/png;base64,${part.base64}`
    : `data:audio/mpeg;base64,${part.base64}`
}

function getMediaDownloadName(part: StarChatPart) {
  const names: Partial<Record<StarChatPart['type'], string>> = {
    image: 'star-image.png',
    audio: 'star-audio.mp3',
    music: 'star-music.mp3',
    video: 'star-video.mp4',
  }

  return names[part.type]
}

const source = computed(() => getMediaSource(props.part))
const downloadName = computed(() => getMediaDownloadName(props.part))
</script>

<template>
  <figure v-if="source" class="star-media-card" :data-kind="part.type">
    <img
      v-if="part.type === 'image'"
      class="star-media-card__image"
      :src="source"
      alt="生成的图片"
    >
    <audio
      v-else-if="part.type === 'audio' || part.type === 'music'"
      controls
      :data-kind="part.type"
      :src="source"
    />
    <video
      v-else-if="part.type === 'video'"
      controls
      :src="source"
    />
    <figcaption class="star-media-card__actions">
      <a
        :href="source"
        :download="downloadName"
        target="_blank"
        rel="noreferrer"
        aria-label="下载资源"
        @click.stop
      >
        下载
      </a>
    </figcaption>
  </figure>
</template>
```

- [ ] **Step 4: Create `StarChatMessage.vue`**

Create `components/StarChatMessage.vue`:

```vue
<script setup lang="ts">
import type { StarChatMessage, StarChatPart } from '../composables/useStarChat'

const props = defineProps<{
  message: StarChatMessage
  active: boolean
}>()

const emit = defineEmits<{
  copy: [message: StarChatMessage]
  activate: []
}>()

function isMediaPart(part: StarChatPart) {
  return ['audio', 'image', 'music', 'video'].includes(part.type)
}
</script>

<template>
  <article
    class="star-chat-message"
    :data-role="message.role"
    :data-active="String(active)"
    @click="emit('activate')"
  >
    <img
      v-if="message.imageDataUrl"
      class="star-chat-message__legacy-image"
      :src="message.imageDataUrl"
      alt=""
    >
    <a
      v-if="message.imageDataUrl"
      class="star-chat-message__download"
      :href="message.imageDataUrl"
      download="star-attachment.png"
      aria-label="下载图片"
      @click.stop
    >
      下载
    </a>

    <template v-if="message.parts?.length">
      <template v-for="(part, partIndex) in message.parts" :key="partIndex">
        <span v-if="part.type === 'text'" class="star-chat-message__text">{{ part.text }}</span>
        <span v-else-if="part.type === 'status'" class="star-chat-message__status">{{ part.text }}</span>
        <StarMediaCard v-else-if="isMediaPart(part)" :part="part" />
      </template>
    </template>
    <span v-else class="star-chat-message__text">{{ message.content }}</span>

    <button
      type="button"
      class="star-chat-message__copy"
      aria-label="复制消息"
      @click.stop="emit('copy', props.message)"
    >
      复制
    </button>
  </article>
</template>
```

- [ ] **Step 5: Update `StarChat.vue` to use `StarChatMessage`**

In `components/StarChat.vue`, remove local `getMediaSource()` and `getMediaDownloadName()`.

Replace the `article v-for` block inside `.star-chat__messages` with:

```vue
<StarChatMessage
  v-for="(message, index) in localMessages"
  :key="`${message.role}-${index}`"
  :message="message"
  :active="activeMessageIndex === index"
  @activate="activeMessageIndex = index"
  @copy="copyMessage"
/>
```

- [ ] **Step 6: Run message tests**

Run:

```bash
npm run test -- components/StarChatMessage.test.ts components/StarChat.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit Task 1**

```bash
git add components/StarMediaCard.vue components/StarChatMessage.vue components/StarChatMessage.test.ts components/StarChat.vue components/StarChat.test.ts
git commit -m "refactor: extract star chat message rendering"
```

---

## Task 2: Extract Thread and Composer Components

**Files:**
- Create: `components/StarChatThread.vue`
- Create: `components/StarComposer.vue`
- Create: `components/StarComposer.test.ts`
- Modify: `components/StarChat.vue`
- Modify: `components/StarChat.test.ts`

- [ ] **Step 1: Write composer tests**

Create `components/StarComposer.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StarComposer from './StarComposer.vue'

describe('StarComposer', () => {
  it('renders multimodal controls and emits submit on Enter', async () => {
    const wrapper = mount(StarComposer, {
      props: {
        input: '',
        pending: false,
        listening: false,
        mode: 'chat',
        selectedMediaKinds: [],
        attachmentMenuOpen: false,
      },
    })

    expect(wrapper.get('button[aria-label="添加附件"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="语音输入"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="设计模式"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="听一听"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="画一张"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="做一段"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="写一首"]').exists()).toBe(true)
    expect(wrapper.get('textarea').attributes('placeholder')).toBe('把想说的话交给这片星空')

    await wrapper.get('textarea').setValue('第一行')
    await wrapper.get('textarea').trigger('keydown.enter')

    expect(wrapper.emitted('update:input')).toEqual([['第一行']])
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('keeps Shift Enter for new lines and switches design mode', async () => {
    const wrapper = mount(StarComposer, {
      props: {
        input: '第一行',
        pending: false,
        listening: false,
        mode: 'chat',
        selectedMediaKinds: [],
        attachmentMenuOpen: false,
      },
    })

    await wrapper.get('textarea').trigger('keydown.enter', { shiftKey: true })
    expect(wrapper.emitted('submit')).toBeUndefined()

    await wrapper.get('button[aria-label="设计模式"]').trigger('click')
    expect(wrapper.emitted('toggle-mode')).toHaveLength(1)
  })

  it('opens attachment options and emits attachment changes', async () => {
    const wrapper = mount(StarComposer, {
      props: {
        input: '',
        pending: false,
        listening: false,
        mode: 'chat',
        selectedMediaKinds: [],
        attachmentMenuOpen: true,
      },
    })

    expect(wrapper.get('label[aria-label="上传图片"]').exists()).toBe(true)
    expect(wrapper.get('label[aria-label="上传音频"]').exists()).toBe(true)
    expect(wrapper.get('label[aria-label="上传视频"]').exists()).toBe(true)

    await wrapper.get('button[aria-label="画一张"]').trigger('click')
    expect(wrapper.emitted('toggle-media-kind')).toEqual([['image']])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test -- components/StarComposer.test.ts
```

Expected: fail because `components/StarComposer.vue` does not exist.

- [ ] **Step 3: Create `StarChatThread.vue`**

Create `components/StarChatThread.vue`:

```vue
<script setup lang="ts">
import type { StarChatMessage as StarChatMessageType } from '../composables/useStarChat'

defineProps<{
  messages: StarChatMessageType[]
  activeMessageIndex: number | null
}>()

const emit = defineEmits<{
  copy: [message: StarChatMessageType]
  activate: [index: number]
  interact: []
}>()
</script>

<template>
  <div
    v-if="messages.length > 0"
    class="star-chat__thread star-chat__thread--transparent star-chat__messages"
    aria-live="polite"
    @click="emit('interact')"
    @touchstart.passive="emit('interact')"
  >
    <StarChatMessage
      v-for="(message, index) in messages"
      :key="`${message.role}-${index}`"
      :message="message"
      :active="activeMessageIndex === index"
      @activate="emit('activate', index)"
      @copy="emit('copy', $event)"
    />
  </div>
</template>
```

- [ ] **Step 4: Create `StarComposer.vue`**

Create `components/StarComposer.vue`:

```vue
<script setup lang="ts">
import type { AttachmentKind, StarChatIntent } from '../composables/useStarChat'

type MediaIntent = Exclude<StarChatIntent, 'auto' | 'chat'>

const props = defineProps<{
  input: string
  pending: boolean
  listening: boolean
  mode: 'chat' | 'design'
  selectedMediaKinds: MediaIntent[]
  attachmentMenuOpen: boolean
}>()

const emit = defineEmits<{
  'update:input': [value: string]
  submit: []
  focus: []
  'toggle-attachments': []
  'attachment-change': [event: Event, kind: AttachmentKind]
  'start-voice': []
  'toggle-mode': []
  'toggle-media-kind': [kind: MediaIntent]
}>()

const mediaActions: Array<{ kind: MediaIntent, label: string, icon: string }> = [
  { kind: 'audio', label: '听一听', icon: 'M12 3v18M8 7v10M4 10v4M16 7v10M20 10v4' },
  { kind: 'image', label: '画一张', icon: 'M4 5h16v14H4zM8 14l2.5-3 2 2.5L15 10l5 6M8 9h.01' },
  { kind: 'video', label: '做一段', icon: 'M4 6h11v12H4zM15 10l5-3v10l-5-3z' },
  { kind: 'music', label: '写一首', icon: 'M9 18V5l10-2v13M9 9l10-2M7 18a2 2 0 1 0 4 0 2 2 0 0 0-4 0M17 16a2 2 0 1 0 4 0 2 2 0 0 0-4 0' },
]

function handleInputEnter(event: KeyboardEvent) {
  if (event.shiftKey || event.isComposing) {
    return
  }

  event.preventDefault()
  emit('submit')
}
</script>

<template>
  <form class="star-chat__composer star-chat__dock" :data-mode="mode" @submit.prevent="emit('submit')">
    <label class="sr-only" for="star-chat-input">和星信说话</label>
    <div class="star-chat__tools">
      <div class="star-chat__attachment-menu">
        <button
          type="button"
          class="star-chat__attachment-button star-chat__icon-button"
          :aria-expanded="attachmentMenuOpen"
          aria-controls="star-chat-attachment-options"
          aria-label="添加附件"
          @click="emit('toggle-attachments')"
        >
          +
        </button>
        <div
          v-if="attachmentMenuOpen"
          id="star-chat-attachment-options"
          class="star-chat__attachment-popover"
          role="menu"
        >
          <label role="menuitem" aria-label="上传图片">
            <span>上传图片</span>
            <input type="file" multiple accept="image/png,image/jpeg,image/webp" @change="emit('attachment-change', $event, 'image')" >
          </label>
          <label role="menuitem" aria-label="上传音频">
            <span>上传音频</span>
            <input type="file" multiple accept="audio/mpeg,audio/mp3,audio/mp4,audio/m4a,audio/wav,audio/webm" @change="emit('attachment-change', $event, 'audio')" >
          </label>
          <label role="menuitem" aria-label="上传视频">
            <span>上传视频</span>
            <input type="file" multiple accept="video/mp4,video/webm,video/quicktime" @change="emit('attachment-change', $event, 'video')" >
          </label>
        </div>
      </div>
      <button type="button" class="star-chat__icon-button" :disabled="pending || listening" aria-label="语音输入" @click="emit('start-voice')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v10" />
          <path d="M8 11a4 4 0 0 0 8 0V7a4 4 0 0 0-8 0v4Z" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3" />
        </svg>
        <span class="sr-only">{{ listening ? '正在听' : '语音输入' }}</span>
      </button>
      <button type="button" class="star-chat__icon-button" :data-active="mode === 'design'" aria-label="设计模式" @click="emit('toggle-mode')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 4 7l8 4 8-4-8-4Z" />
          <path d="M4 12l8 4 8-4" />
          <path d="M4 17l8 4 8-4" />
        </svg>
        <span class="sr-only">设计模式</span>
      </button>
      <button
        v-for="action in mediaActions"
        :key="action.kind"
        type="button"
        class="star-chat__icon-button"
        :data-active="selectedMediaKinds.includes(action.kind)"
        :disabled="pending"
        :aria-label="action.label"
        @click="emit('toggle-media-kind', action.kind)"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path :d="action.icon" />
        </svg>
        <span class="sr-only">{{ action.label }}</span>
      </button>
    </div>
    <textarea
      id="star-chat-input"
      :value="input"
      rows="1"
      :placeholder="mode === 'design' ? '请输入你的创意想法' : '把想说的话交给这片星空'"
      @input="emit('update:input', ($event.target as HTMLTextAreaElement).value)"
      @focus="emit('focus')"
      @keydown.enter="handleInputEnter"
    />
    <button class="star-chat__icon-button star-chat__icon-button--send" type="submit" :disabled="pending" aria-label="发送">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h13" />
        <path d="m13 6 6 6-6 6" />
      </svg>
      <span class="sr-only">{{ pending ? '等待发送' : '发送' }}</span>
    </button>
  </form>
</template>
```

- [ ] **Step 5: Wire `StarChat.vue` to extracted components**

In `components/StarChat.vue`:

Remove `mediaActions` and `handleInputEnter`.

Replace the thread div with:

```vue
<StarChatThread
  ref="messagesThreadRef"
  :messages="localMessages"
  :active-message-index="activeMessageIndex"
  @interact="threadActive = true"
  @activate="activeMessageIndex = $event"
  @copy="copyMessage"
/>
```

Replace the `<form class="star-chat__composer...">...</form>` with:

```vue
<div ref="attachmentMenuRef">
  <StarComposer
    v-model:input="input"
    :pending="pending"
    :listening="listening"
    :mode="mode"
    :selected-media-kinds="selectedMediaKinds"
    :attachment-menu-open="attachmentMenuOpen"
    @submit="submit"
    @focus="threadActive = true"
    @toggle-attachments="attachmentMenuOpen = !attachmentMenuOpen"
    @attachment-change="handleAttachmentChange"
    @start-voice="startVoiceInput"
    @toggle-mode="mode = mode === 'design' ? 'chat' : 'design'"
    @toggle-media-kind="toggleMediaKind"
  />
</div>
```

Because `StarChatThread` wraps the scroll div, change `messagesThreadRef` type to component-compatible:

```ts
const messagesThreadRef = ref<{ $el: HTMLElement } | null>(null)
```

And update `scrollMessagesToLatest()`:

```ts
const thread = messagesThreadRef.value?.$el
```

- [ ] **Step 6: Run extracted component tests**

Run:

```bash
npm run test -- components/StarComposer.test.ts components/StarChat.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit Task 2**

```bash
git add components/StarChatThread.vue components/StarComposer.vue components/StarComposer.test.ts components/StarChat.vue components/StarChat.test.ts
git commit -m "refactor: extract star chat composer and thread"
```

---

## Task 3: Add Starry Theater Visual System

**Files:**
- Modify: `pages/chat.vue`
- Modify: `assets/css/main.css`
- Modify: `tests/e2e/main-flow.spec.ts`

- [ ] **Step 1: Add visual contract checks to E2E**

In `tests/e2e/main-flow.spec.ts`, after `await expect(page.getByRole('complementary', { name: '星信' })).toBeVisible()`, add:

```ts
await expect(page.locator('.chat-theater')).toBeVisible()
await expect(page.locator('.chat-theater__atmosphere')).toBeVisible()
await expect(page.locator('.star-chat__dock')).toHaveAttribute('data-mode', 'chat')
```

Replace:

```ts
await expect(page.getByPlaceholder('要求后续变更')).toBeVisible()
```

with:

```ts
await expect(page.getByPlaceholder('把想说的话交给这片星空')).toBeVisible()
```

- [ ] **Step 2: Run E2E to verify it fails**

Run:

```bash
npm run test:e2e -- tests/e2e/main-flow.spec.ts
```

Expected: fail because `.chat-theater` and `.chat-theater__atmosphere` do not exist yet.

- [ ] **Step 3: Add theater shell to `/chat`**

Modify `pages/chat.vue` template:

```vue
<template>
  <main class="app-page chat-theater">
    <ClientOnly>
      <div class="chat-theater__atmosphere" aria-hidden="true">
        <span class="chat-theater__star chat-theater__star--one" />
        <span class="chat-theater__star chat-theater__star--two" />
        <span class="chat-theater__star chat-theater__star--three" />
        <span class="chat-theater__meteor" />
      </div>
      <DynamicStarPage v-if="currentSchema" :schema="currentSchema" />
      <StarScene v-else />
      <aside class="star-quota" aria-label="星能量">
        <MiniMaxQuotaPanel />
      </aside>
      <StarChat :initial-messages="chatMessages" @design-requested="previewDesign" />
      <ProfileSettingsSheet />
      <DesignPreviewSheet
        v-if="previewSchema"
        :schema="previewSchema"
        @confirm="commitDesign()"
        @cancel="discardPreview"
      />
    </ClientOnly>
  </main>
</template>
```

- [ ] **Step 4: Add theater CSS**

Append to `assets/css/main.css`:

```css
.chat-theater {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 16%, rgb(255 214 188 / 0.28), transparent 22rem),
    radial-gradient(circle at 78% 12%, rgb(157 192 255 / 0.18), transparent 24rem),
    radial-gradient(circle at 48% 88%, rgb(255 240 194 / 0.16), transparent 20rem),
    linear-gradient(145deg, #0d1324 0%, #171425 52%, #231724 100%);
}

.chat-theater__atmosphere {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.chat-theater__star {
  position: absolute;
  width: 0.18rem;
  height: 0.18rem;
  border-radius: 999px;
  background: rgb(255 247 216 / 0.92);
  box-shadow:
    0 0 1.8rem rgb(255 232 180 / 0.7),
    5rem 3rem 0 rgb(255 255 255 / 0.5),
    12rem 9rem 0 rgb(210 226 255 / 0.42),
    20rem 2rem 0 rgb(255 227 198 / 0.38);
  animation: theater-star-drift 16s ease-in-out infinite alternate;
}

.chat-theater__star--one {
  top: 16%;
  left: 12%;
}

.chat-theater__star--two {
  top: 24%;
  right: 18%;
  animation-duration: 19s;
}

.chat-theater__star--three {
  bottom: 26%;
  left: 28%;
  animation-duration: 23s;
}

.chat-theater__meteor {
  position: absolute;
  top: 18%;
  left: 72%;
  width: 9rem;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgb(255 245 213 / 0.86), transparent);
  transform: rotate(-24deg);
  animation: theater-meteor 9s ease-in-out infinite;
}

@keyframes theater-star-drift {
  from {
    transform: translate3d(0, 0, 0);
    opacity: 0.72;
  }

  to {
    transform: translate3d(1.2rem, -0.8rem, 0);
    opacity: 1;
  }
}

@keyframes theater-meteor {
  0%,
  72% {
    opacity: 0;
    transform: translate3d(0, 0, 0) rotate(-24deg);
  }

  78% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: translate3d(-24rem, 10rem, 0) rotate(-24deg);
  }
}

.chat-theater > :not(.chat-theater__atmosphere) {
  position: relative;
  z-index: 1;
}

@media (prefers-color-scheme: light) {
  .chat-theater {
    background:
      radial-gradient(circle at 20% 16%, rgb(255 222 204 / 0.74), transparent 22rem),
      radial-gradient(circle at 76% 14%, rgb(185 210 255 / 0.42), transparent 24rem),
      radial-gradient(circle at 48% 88%, rgb(255 244 201 / 0.34), transparent 20rem),
      linear-gradient(145deg, #fff8f1 0%, #f8edf3 56%, #edf4ff 100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .chat-theater__star,
  .chat-theater__meteor {
    animation: none;
  }
}
```

- [ ] **Step 5: Run E2E**

Run:

```bash
npm run test:e2e -- tests/e2e/main-flow.spec.ts
```

Expected: pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add pages/chat.vue assets/css/main.css tests/e2e/main-flow.spec.ts
git commit -m "feat: add starry theater chat shell"
```

---

## Task 4: Style Messages, Media Cards, and Composer

**Files:**
- Modify: `assets/css/main.css`
- Modify: `components/StarChat.test.ts`
- Modify: `components/StarChatMessage.test.ts`
- Modify: `components/StarComposer.test.ts`

- [ ] **Step 1: Add class contract tests**

In `components/StarChatMessage.test.ts`, add:

```ts
it('uses theater message classes for visual states', () => {
  const wrapper = mount(StarChatMessage, {
    props: {
      message: { role: 'user', content: '这是一封短笺。' },
      active: true,
    },
  })

  expect(wrapper.classes()).toContain('star-chat-message')
  expect(wrapper.attributes('data-active')).toBe('true')
  expect(wrapper.attributes('data-role')).toBe('user')
  expect(wrapper.get('.star-chat-message__copy').exists()).toBe(true)
})
```

In `components/StarComposer.test.ts`, add:

```ts
it('marks design mode on the composer shell', () => {
  const wrapper = mount(StarComposer, {
    props: {
      input: '',
      pending: false,
      listening: false,
      mode: 'design',
      selectedMediaKinds: ['image'],
      attachmentMenuOpen: false,
    },
  })

  expect(wrapper.get('form').attributes('data-mode')).toBe('design')
  expect(wrapper.get('textarea').attributes('placeholder')).toBe('请输入你的创意想法')
  expect(wrapper.get('button[aria-label="画一张"]').attributes('data-active')).toBe('true')
})
```

- [ ] **Step 2: Run component tests**

Run:

```bash
npm run test -- components/StarChatMessage.test.ts components/StarComposer.test.ts components/StarChat.test.ts
```

Expected: pass or fail only on missing classes that will be added in the next step.

- [ ] **Step 3: Add message, media, and composer CSS**

Append to `assets/css/main.css`:

```css
.star-chat__messages {
  display: grid;
  gap: 0.78rem;
  width: min(100%, 52rem);
  max-height: min(54vh, 34rem);
  margin-inline: auto;
  padding: 1rem 0.9rem 0.35rem;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
  mask-image: linear-gradient(180deg, transparent 0, black 2rem, black calc(100% - 0.4rem));
}

.star-chat-message {
  position: relative;
  width: fit-content;
  max-width: min(88%, 38rem);
  padding: 0.72rem 0.86rem;
  color: var(--chat-thread-ink);
  line-height: 1.72;
  white-space: pre-wrap;
  border: 1px solid transparent;
  border-radius: 1.1rem;
  background: rgb(255 255 255 / 0.08);
  box-shadow: 0 1rem 2.6rem rgb(0 0 0 / 0.12);
  backdrop-filter: blur(12px);
  transition:
    transform 180ms ease,
    background 180ms ease,
    border-color 180ms ease,
    opacity 180ms ease;
}

.star-chat-message[data-role="user"] {
  justify-self: end;
  color: var(--chat-thread-ink);
  background: var(--chat-user-bubble);
}

.star-chat-message[data-role="assistant"] {
  justify-self: start;
  background: var(--chat-assistant-bubble);
}

.star-chat[data-thread-active="false"] .star-chat-message {
  opacity: 0.62;
}

.star-chat-message:is(:hover, :focus-within),
.star-chat-message[data-active="true"] {
  border-color: rgb(255 244 231 / 0.22);
  opacity: 1;
  transform: translateY(-1px);
}

.star-chat-message__status {
  color: var(--chat-thread-ink-soft);
  font-size: 0.85rem;
}

.star-chat-message__copy,
.star-chat-message__download,
.star-media-card__actions a {
  position: absolute;
  right: 0.45rem;
  top: -0.7rem;
  border: 1px solid rgb(255 255 255 / 0.16);
  border-radius: 999px;
  padding: 0.22rem 0.48rem;
  color: var(--chat-ink);
  font: inherit;
  font-size: 0.72rem;
  background: var(--chat-surface-soft);
  opacity: 0;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 150ms ease, transform 150ms ease;
}

.star-chat-message:is(:hover, :focus-within) .star-chat-message__copy,
.star-chat-message[data-active="true"] .star-chat-message__copy,
.star-chat-message:is(:hover, :focus-within) .star-chat-message__download,
.star-chat-message[data-active="true"] .star-chat-message__download,
.star-media-card:is(:hover, :focus-within) .star-media-card__actions a {
  opacity: 1;
  transform: translateY(-1px);
}

.star-media-card {
  position: relative;
  display: grid;
  gap: 0.45rem;
  width: min(100%, 22rem);
  margin: 0.3rem 0 0;
  padding: 0.55rem;
  border: 1px solid rgb(255 244 231 / 0.14);
  border-radius: 1rem;
  background:
    radial-gradient(circle at 18% 18%, rgb(255 239 203 / 0.18), transparent 8rem),
    rgb(255 255 255 / 0.08);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.1),
    0 1.1rem 2.8rem rgb(0 0 0 / 0.16);
}

.star-media-card__image,
.star-media-card video {
  display: block;
  width: 100%;
  max-height: 18rem;
  object-fit: cover;
  border-radius: 0.72rem;
}

.star-media-card audio {
  width: 100%;
}

.star-chat__dock {
  width: min(calc(100vw - 2rem), 46rem);
  margin-inline: auto;
  border: 1px solid rgb(255 244 231 / 0.16);
  border-radius: 1.3rem;
  padding: 0.52rem;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 0.14), rgb(255 255 255 / 0.06)),
    var(--chat-surface-soft);
  box-shadow:
    0 1.2rem 3.2rem rgb(0 0 0 / 0.26),
    inset 0 1px 0 rgb(255 255 255 / 0.14);
  backdrop-filter: blur(20px);
}

.star-chat__dock:focus-within {
  animation: star-composer-breathe 2.4s ease-in-out infinite;
}

.star-chat__dock[data-mode="design"] {
  border-color: rgb(160 198 255 / 0.38);
  box-shadow:
    0 1.4rem 3.5rem rgb(49 78 132 / 0.28),
    0 0 0 1px rgb(160 198 255 / 0.16),
    inset 0 1px 0 rgb(255 255 255 / 0.18);
}

@keyframes star-composer-breathe {
  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.012);
  }
}
```

- [ ] **Step 4: Run unit tests**

Run:

```bash
npm run test -- components/StarChatMessage.test.ts components/StarComposer.test.ts components/StarChat.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 4**

```bash
git add assets/css/main.css components/StarChat.test.ts components/StarChatMessage.test.ts components/StarComposer.test.ts
git commit -m "feat: style starry chat interactions"
```

---

## Task 5: Add Memory Star Map Entry

**Files:**
- Create: `components/StarMemoryMap.vue`
- Create: `components/StarMemoryMap.test.ts`
- Modify: `pages/chat.vue`
- Modify: `assets/css/main.css`
- Modify: `tests/e2e/main-flow.spec.ts`

- [ ] **Step 1: Write memory map tests**

Create `components/StarMemoryMap.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StarMemoryMap from './StarMemoryMap.vue'

describe('StarMemoryMap', () => {
  it('renders a memory star-map button that opens settings', async () => {
    const wrapper = mount(StarMemoryMap)

    expect(wrapper.get('button[aria-label="打开记忆星图"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('记忆星图')

    await wrapper.get('button[aria-label="打开记忆星图"]').trigger('click')

    expect(wrapper.emitted('open-settings')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- components/StarMemoryMap.test.ts
```

Expected: fail because `components/StarMemoryMap.vue` does not exist.

- [ ] **Step 3: Create `StarMemoryMap.vue`**

Create `components/StarMemoryMap.vue`:

```vue
<script setup lang="ts">
const emit = defineEmits<{
  'open-settings': []
}>()
</script>

<template>
  <aside class="star-memory-map" aria-label="记忆星图">
    <button type="button" aria-label="打开记忆星图" @click="emit('open-settings')">
      <span class="star-memory-map__constellation" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>
        <strong>记忆星图</strong>
        <small>称呼、性格和她的星点</small>
      </span>
    </button>
  </aside>
</template>
```

- [ ] **Step 4: Wire memory map in `/chat`**

Modify `pages/chat.vue`:

Add:

```ts
const profileSettingsOpen = ref(false)
```

Replace:

```vue
<ProfileSettingsSheet />
```

with:

```vue
<StarMemoryMap @open-settings="profileSettingsOpen = true" />
<ProfileSettingsSheet :open="profileSettingsOpen" @close="profileSettingsOpen = false" />
```

If `ProfileSettingsSheet` does not support `open` and `close`, inspect `components/ProfileSettingsSheet.vue` and keep its existing trigger button. In that case, render `StarMemoryMap` as a visual companion only and leave the existing settings trigger intact.

- [ ] **Step 5: Add memory map CSS**

Append to `assets/css/main.css`:

```css
.star-memory-map {
  position: fixed;
  right: clamp(1rem, 3vw, 2rem);
  bottom: clamp(5.8rem, 12vh, 8rem);
  z-index: 4;
}

.star-memory-map button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.65rem;
  border: 1px solid rgb(255 244 231 / 0.16);
  border-radius: 999px;
  padding: 0.5rem 0.8rem 0.5rem 0.55rem;
  color: var(--chat-ink);
  background: var(--chat-surface-soft);
  box-shadow: 0 1rem 2.6rem rgb(0 0 0 / 0.22);
  cursor: pointer;
  backdrop-filter: blur(18px);
}

.star-memory-map strong,
.star-memory-map small {
  display: block;
  text-align: left;
}

.star-memory-map strong {
  font-size: 0.82rem;
  font-weight: 600;
}

.star-memory-map small {
  color: var(--chat-ink-soft);
  font-size: 0.68rem;
}

.star-memory-map__constellation {
  position: relative;
  display: block;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 999px;
  background: rgb(255 244 231 / 0.08);
}

.star-memory-map__constellation i {
  position: absolute;
  width: 0.22rem;
  height: 0.22rem;
  border-radius: 999px;
  background: rgb(255 241 190 / 0.92);
  box-shadow: 0 0 0.8rem rgb(255 224 164 / 0.8);
}

.star-memory-map__constellation i:nth-child(1) {
  left: 0.5rem;
  top: 0.7rem;
}

.star-memory-map__constellation i:nth-child(2) {
  left: 1.25rem;
  top: 0.45rem;
}

.star-memory-map__constellation i:nth-child(3) {
  left: 1.45rem;
  top: 1.35rem;
}

.star-memory-map__constellation i:nth-child(4) {
  left: 0.75rem;
  top: 1.55rem;
}

@media (max-width: 720px) {
  .star-memory-map {
    right: 0.85rem;
    bottom: 5.4rem;
  }

  .star-memory-map small {
    display: none;
  }
}
```

- [ ] **Step 6: Update E2E settings selector if needed**

If `ProfileSettingsSheet` still exposes `button[name="打开设置"]`, keep the existing E2E line:

```ts
await page.getByRole('button', { name: '打开设置' }).click()
```

If `StarMemoryMap` becomes the trigger, replace it with:

```ts
await page.getByRole('button', { name: '打开记忆星图' }).click()
```

- [ ] **Step 7: Run tests**

Run:

```bash
npm run test -- components/StarMemoryMap.test.ts components/ProfileSettingsSheet.test.ts
npm run test:e2e -- tests/e2e/main-flow.spec.ts
```

Expected: pass.

- [ ] **Step 8: Commit Task 5**

```bash
git add components/StarMemoryMap.vue components/StarMemoryMap.test.ts pages/chat.vue assets/css/main.css tests/e2e/main-flow.spec.ts
git commit -m "feat: add memory star map entry"
```

---

## Task 6: Full Verification and Visual Browser Check

**Files:**
- Modify only if verification exposes a bug.

- [ ] **Step 1: Run full unit tests**

Run:

```bash
npm run test
```

Expected: all test files pass.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: build exits 0. Existing sourcemap warnings are acceptable if unchanged.

- [ ] **Step 3: Run E2E**

Run:

```bash
npm run test:e2e
```

Expected: Playwright tests pass.

- [ ] **Step 4: Run diff hygiene check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 5: Start local server for browser inspection**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: local Nuxt dev server starts, usually at `http://127.0.0.1:3000/`.

- [ ] **Step 6: Inspect `/chat` in browser**

Use the in-app browser or Playwright against `http://127.0.0.1:3000/`.

Check desktop viewport:

- `/chat` has `.chat-theater`.
- composer is visible and does not overlap messages.
- attachment popover is readable.
- message copy/download actions appear on hover or focus.
- memory star map does not cover composer.

Check mobile viewport:

- composer fits inside viewport.
- tool buttons do not overlap text input.
- messages remain readable.
- star quota and memory star map do not block primary actions.

- [ ] **Step 7: Commit fixes from verification if any**

If Step 1-6 required fixes:

```bash
git add <changed-files>
git commit -m "fix: polish starry chat theater"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review

- Spec coverage: covered visual shell, message treatment, media cards, composer controls, memory star map, responsive behavior, accessibility labels, and verification.
- Scope boundary: no MiniMax service changes, no auth/session changes, no video generation chain rewrite, no 3D engine.
- Type consistency: component props use existing `StarChatMessage`, `StarChatPart`, `AttachmentKind`, and `StarChatIntent` from `useStarChat`.
- Placeholder scan: no task uses unresolved marker words or unspecified test instructions.
