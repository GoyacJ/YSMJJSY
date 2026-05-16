# Chat Magic Stage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild `/chat` into a romantic magic star stage where user text floats onto the page character by character and AI replies appear as magic-glow text, while keeping the current bottom composer behavior unchanged.

**Architecture:** Keep `StarChat.vue` as the state and streaming container. Replace the current static letter page and transparent thread presentation with a dedicated `StarMagicStage.vue` and `StarGlyphText.vue`. Use CSS animations and Vue-rendered character spans; do not change MiniMax APIs, persistence, key routing, or `StarComposer.vue` behavior.

**Tech Stack:** Nuxt 3, Vue 3 `<script setup>`, TypeScript, Vitest, Vue Test Utils, Playwright, CSS in `assets/css/main.css`.

---

## Task 1: Remove Static Letter Surface From `/chat`

**Files:**
- Modify: `pages/chat.vue`
- Modify: `tests/e2e/main-flow.spec.ts`

**Step 1: Update the e2e expectation**

In `tests/e2e/main-flow.spec.ts`, replace assertions that depend on the old letter page surface:

```ts
await expect(page.getByLabel('钥匙页面')).toHaveCount(0)
await expect(page.locator('.star-magic-stage')).toBeVisible()
await expect(page.getByText('这里会慢慢写下只属于这把钥匙的内容。')).toHaveCount(0)
```

Keep existing checks for:

```ts
await expect(page.getByRole('complementary', { name: '星信' })).toBeVisible()
await expect(page.locator('.chat-theater')).toBeVisible()
await expect(page.locator('.chat-theater__atmosphere')).toBeVisible()
```

**Step 2: Run e2e and verify failure**

Run:

```bash
npm run test:e2e -- --project=chromium
```

Expected: fail because `.star-magic-stage` does not exist yet.

**Step 3: Remove old page rendering**

In `pages/chat.vue`, remove:

```vue
<DynamicStarPage v-if="currentSchema" :schema="currentSchema" />
<StarScene v-else />
```

Keep `loadDesign()` in place for route validity and future theme use.

**Step 4: Add the future stage marker**

Still in `pages/chat.vue`, do not add visible content yet. The marker will come from `StarChat` in Task 2.

**Step 5: Run targeted e2e**

Run:

```bash
npm run test:e2e -- --project=chromium
```

Expected: still fail on `.star-magic-stage`, pass old letter content removal assertions.

---

## Task 2: Add `StarGlyphText` Character Renderer

**Files:**
- Create: `components/StarGlyphText.vue`
- Create: `components/StarGlyphText.test.ts`

**Step 1: Write failing tests**

Create `components/StarGlyphText.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StarGlyphText from './StarGlyphText.vue'

describe('StarGlyphText', () => {
  it('splits text into animated glyphs', () => {
    const wrapper = mount(StarGlyphText, {
      props: {
        text: '星信',
        role: 'user',
      },
    })

    const glyphs = wrapper.findAll('.star-glyph-text__glyph')
    expect(glyphs).toHaveLength(2)
    expect(glyphs.map(item => item.text())).toEqual(['星', '信'])
    expect(wrapper.attributes('data-role')).toBe('user')
    expect(glyphs[1].attributes('style')).toContain('--glyph-delay')
  })

  it('keeps whitespace visible', () => {
    const wrapper = mount(StarGlyphText, {
      props: {
        text: '星 信',
        role: 'assistant',
      },
    })

    expect(wrapper.text()).toContain('星 信')
    expect(wrapper.attributes('data-role')).toBe('assistant')
  })
})
```

**Step 2: Run the failing test**

Run:

```bash
npm run test -- components/StarGlyphText.test.ts
```

Expected: fail because `StarGlyphText.vue` does not exist.

**Step 3: Implement `StarGlyphText.vue`**

Create `components/StarGlyphText.vue`:

```vue
<script setup lang="ts">
const props = defineProps<{
  text: string
  role: 'user' | 'assistant'
}>()

const glyphs = computed(() => Array.from(props.text))

function getDelay(index: number) {
  const base = props.role === 'user' ? 28 : 18
  return `${index * base}ms`
}
</script>

<template>
  <span class="star-glyph-text" :data-role="role">
    <span
      v-for="(glyph, index) in glyphs"
      :key="`${index}-${glyph}`"
      class="star-glyph-text__glyph"
      :style="{ '--glyph-delay': getDelay(index) }"
    >{{ glyph }}</span>
  </span>
</template>
```

**Step 4: Run the test**

Run:

```bash
npm run test -- components/StarGlyphText.test.ts
```

Expected: pass.

---

## Task 3: Render Messages as Magic Stage Entries

**Files:**
- Modify: `components/StarChatMessage.vue`
- Modify: `components/StarChatMessage.test.ts`
- Modify: `components/StarChat.test.ts`

**Step 1: Add failing message animation tests**

In `components/StarChatMessage.test.ts`, add:

```ts
it('renders user text as floating glyphs', () => {
  const wrapper = mount(StarChatMessage, {
    props: {
      message: {
        role: 'user',
        content: '今晚见',
        parts: [{ type: 'text', text: '今晚见' }],
      },
      active: false,
    },
  })

  expect(wrapper.classes()).toContain('star-chat-message--spell')
  expect(wrapper.get('.star-glyph-text[data-role="user"]').text()).toContain('今晚见')
})

it('renders assistant text with a magic orb', () => {
  const wrapper = mount(StarChatMessage, {
    props: {
      message: {
        role: 'assistant',
        content: '我在。',
        parts: [{ type: 'text', text: '我在。' }],
      },
      active: false,
    },
  })

  expect(wrapper.classes()).toContain('star-chat-message--magic')
  expect(wrapper.get('.star-chat-message__orb').exists()).toBe(true)
  expect(wrapper.get('.star-glyph-text[data-role="assistant"]').text()).toContain('我在。')
})
```

**Step 2: Run focused tests**

Run:

```bash
npm run test -- components/StarChatMessage.test.ts
```

Expected: fail because classes, orb, and glyph component are not wired.

**Step 3: Update `StarChatMessage.vue`**

Import `StarGlyphText` and route text rendering through it:

```vue
<script setup lang="ts">
import StarGlyphText from './StarGlyphText.vue'
import StarMediaCard from './StarMediaCard.vue'
import type { StarChatMessage, StarChatPart } from '../composables/useStarChat'

const props = defineProps<{
  message: StarChatMessage
  active: boolean
}>()

const emit = defineEmits<{
  copy: [message: StarChatMessage]
  activate: []
}>()

const messageClass = computed(() => ({
  'star-chat-message--spell': props.message.role === 'user',
  'star-chat-message--magic': props.message.role === 'assistant',
}))

function isMediaPart(part: StarChatPart) {
  return ['audio', 'image', 'music', 'video'].includes(part.type)
}
</script>
```

In the template:

```vue
<article
  class="star-chat-message"
  :class="messageClass"
  :data-role="message.role"
  :data-active="String(active)"
  @click="emit('activate')"
>
  <span v-if="message.role === 'assistant'" class="star-chat-message__orb" aria-hidden="true" />

  <template v-if="message.parts?.length">
    <template v-for="(part, partIndex) in message.parts" :key="partIndex">
      <StarGlyphText
        v-if="part.type === 'text'"
        class="star-chat-message__text"
        :text="part.text"
        :role="message.role"
      />
      <span v-else-if="part.type === 'status'" class="star-chat-message__status">{{ part.text }}</span>
      <StarMediaCard v-else-if="isMediaPart(part)" :part="part" />
    </template>
  </template>
  <StarGlyphText v-else class="star-chat-message__text" :text="message.content" :role="message.role" />

  <button type="button" class="star-chat-message__copy" aria-label="复制消息" @click.stop="emit('copy', props.message)">
    复制
  </button>
</article>
```

Preserve legacy `imageDataUrl` block only if tests still require it.

**Step 4: Run focused tests**

Run:

```bash
npm run test -- components/StarChatMessage.test.ts components/StarChat.test.ts
```

Expected: pass after updating any text selectors that relied on plain `span.star-chat-message__text`.

---

## Task 4: Move Thread Into `StarMagicStage`

**Files:**
- Create: `components/StarMagicStage.vue`
- Modify: `components/StarChat.vue`
- Modify: `components/StarChatThread.vue`
- Modify: `components/StarChat.test.ts`

**Step 1: Add failing tests**

In `components/StarChat.test.ts`, add:

```ts
it('renders the magic stage instead of the old letter surface', () => {
  const wrapper = mountStarChat({
    props: {
      initialMessages: [
        { role: 'user', content: '今晚见。', parts: [{ type: 'text' as const, text: '今晚见。' }] },
        { role: 'assistant', content: '我在星光里。', parts: [{ type: 'text' as const, text: '我在星光里。' }] },
      ],
    },
  })

  expect(wrapper.get('.star-magic-stage').exists()).toBe(true)
  expect(wrapper.text()).toContain('今晚见。')
  expect(wrapper.text()).toContain('我在星光里。')
  expect(wrapper.text()).not.toContain('这里会慢慢写下只属于这把钥匙的内容。')
})
```

**Step 2: Run tests**

Run:

```bash
npm run test -- components/StarChat.test.ts
```

Expected: fail because `.star-magic-stage` does not exist.

**Step 3: Create `StarMagicStage.vue`**

Create:

```vue
<script setup lang="ts">
import StarChatThread from './StarChatThread.vue'
import type { StarChatMessage } from '../composables/useStarChat'

defineProps<{
  messages: StarChatMessage[]
  activeMessageIndex: number | null
}>()

const emit = defineEmits<{
  copy: [message: StarChatMessage]
  activate: [index: number]
  interact: []
}>()
</script>

<template>
  <section class="star-magic-stage" aria-label="星信舞台" @click="emit('interact')" @touchstart.passive="emit('interact')">
    <div class="star-magic-stage__veil" aria-hidden="true" />
    <div class="star-magic-stage__constellation" aria-hidden="true">
      <span v-for="index in 18" :key="index" />
    </div>
    <StarChatThread
      :messages="messages"
      :active-message-index="activeMessageIndex"
      @copy="emit('copy', $event)"
      @activate="emit('activate', $event)"
      @interact="emit('interact')"
    />
  </section>
</template>
```

**Step 4: Wire `StarChat.vue`**

Replace the inline thread block inside `.star-chat__note`:

```vue
<StarMagicStage
  ref="messagesThreadRef"
  :messages="localMessages"
  :active-message-index="activeMessageIndex"
  @interact="threadActive = true"
  @activate="activeMessageIndex = $event"
  @copy="copyMessage"
/>
```

Keep attachments, error, and `StarComposer` in their current bottom structure.

**Step 5: Ensure scroll target still works**

If `messagesThreadRef.value?.$el` now points to the stage, update `scrollMessagesToLatest()` to query:

```ts
const thread = messagesThreadRef.value?.$el.querySelector('.star-chat__messages') as HTMLElement | null
```

Fallback to `$el` if the query is missing.

**Step 6: Run tests**

Run:

```bash
npm run test -- components/StarChat.test.ts components/StarChatMessage.test.ts
```

Expected: pass.

---

## Task 5: Add Magic Stage Styling and Motion

**Files:**
- Modify: `assets/css/main.css`

**Step 1: Add CSS for stage layout**

Add CSS near current `.star-chat__messages` styles:

```css
.star-magic-stage {
  position: fixed;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  padding: 7rem 1.25rem 7.25rem;
  pointer-events: none;
}

.star-magic-stage__veil {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 52% 46%, rgb(255 236 194 / 0.18), transparent 18rem),
    radial-gradient(circle at 26% 70%, rgb(160 198 255 / 0.12), transparent 20rem);
  pointer-events: none;
}

.star-chat__messages {
  position: relative;
  z-index: 1;
  display: grid;
  width: min(100%, 52rem);
  max-height: min(58vh, 36rem);
  gap: 1rem;
  overflow-y: auto;
  pointer-events: auto;
}
```

**Step 2: Add glyph motion**

Add:

```css
.star-glyph-text {
  display: inline;
}

.star-glyph-text__glyph {
  display: inline-block;
  animation-delay: var(--glyph-delay);
  animation-fill-mode: both;
}

.star-glyph-text[data-role="user"] .star-glyph-text__glyph {
  animation-name: star-user-glyph-float;
  animation-duration: 720ms;
  animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
}

.star-glyph-text[data-role="assistant"] .star-glyph-text__glyph {
  animation-name: star-ai-glyph-pop;
  animation-duration: 540ms;
  animation-timing-function: cubic-bezier(0.18, 0.92, 0.24, 1);
}

@keyframes star-user-glyph-float {
  from {
    opacity: 0;
    transform: translate3d(1.5rem, 4rem, 0) rotate(3deg);
    filter: blur(0.35rem);
    text-shadow: 0 0 1.4rem rgb(255 231 185 / 0.85);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
    filter: blur(0);
    text-shadow: 0 0 0.45rem rgb(255 231 185 / 0.24);
  }
}

@keyframes star-ai-glyph-pop {
  from {
    opacity: 0;
    transform: translateY(0.7rem) scale(0.72);
    filter: blur(0.28rem);
    text-shadow: 0 0 1.2rem rgb(160 198 255 / 0.86);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
    text-shadow: 0 0 0.5rem rgb(160 198 255 / 0.26);
  }
}
```

**Step 3: Add message magic styling**

Add:

```css
.star-chat-message {
  pointer-events: auto;
}

.star-chat-message--spell {
  justify-self: end;
  max-width: min(78%, 34rem);
  color: rgb(255 244 231 / 0.94);
  background: transparent;
  box-shadow: none;
}

.star-chat-message--magic {
  justify-self: start;
  max-width: min(82%, 38rem);
  border-color: rgb(160 198 255 / 0.16);
  background:
    radial-gradient(circle at 1.2rem 1.2rem, rgb(160 198 255 / 0.2), transparent 6rem),
    rgb(16 20 33 / 0.58);
}

.star-chat-message__orb {
  position: absolute;
  top: 0.85rem;
  left: -0.45rem;
  width: 0.62rem;
  height: 0.62rem;
  border-radius: 999px;
  background: rgb(229 239 255 / 0.96);
  box-shadow:
    0 0 0.9rem rgb(160 198 255 / 0.84),
    0 0 2rem rgb(255 231 185 / 0.32);
  animation: star-magic-orb 1.8s ease-in-out infinite alternate;
}

@keyframes star-magic-orb {
  from {
    transform: translateY(0) scale(0.92);
  }

  to {
    transform: translateY(-0.22rem) scale(1.08);
  }
}
```

**Step 4: Add responsive and reduced-motion rules**

Add:

```css
@media (max-width: 640px) {
  .star-magic-stage {
    padding: 8.5rem 1rem 6.6rem;
    place-items: end center;
  }

  .star-chat__messages {
    max-height: 52vh;
  }

  .star-chat-message--spell,
  .star-chat-message--magic {
    max-width: 90%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .star-glyph-text__glyph,
  .star-chat-message__orb {
    animation: none;
  }
}
```

**Step 5: Run unit tests**

Run:

```bash
npm run test -- StarChat StarChatMessage StarGlyphText
```

Expected: pass.

---

## Task 6: Full Browser Verification

**Files:**
- Modify only if verification exposes layout issues.

**Step 1: Run full unit suite**

Run:

```bash
npm run test
```

Expected: all tests pass.

**Step 2: Run build**

Run:

```bash
npm run build
```

Expected: build succeeds. Existing sourcemap warnings from Nuxt/Tailwind plugins are acceptable.

**Step 3: Run e2e**

Run:

```bash
npm run test:e2e
```

Expected: chromium and mobile pass.

**Step 4: Playwright visual check**

Use a browser script to:

1. Create a key through `/api/keys`.
2. Configure profile through `/api/key/profile`.
3. Mock `/api/chat/stream` with a short assistant reply.
4. Open `/chat`.
5. Send `今晚的星空很认真。`.
6. Capture desktop `1440x900` and mobile `390x844` screenshots.
7. Assert:

```ts
document.querySelector('.star-magic-stage')
document.querySelector('.star-glyph-text[data-role="user"]')
document.querySelector('.star-glyph-text[data-role="assistant"]')
!document.body.innerText.includes('这里会慢慢写下只属于这把钥匙的内容。')
```

Expected: stage is visible, old letter area is gone, composer still works, quota and memory map do not overlap composer.

**Step 5: Commit**

After verification:

```bash
git add pages/chat.vue components/StarGlyphText.vue components/StarMagicStage.vue components/StarChat.vue components/StarChatMessage.vue components/StarGlyphText.test.ts components/StarChatMessage.test.ts components/StarChat.test.ts tests/e2e/main-flow.spec.ts assets/css/main.css
git commit -m "feat: add magic star chat stage"
```

