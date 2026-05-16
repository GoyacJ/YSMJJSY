# Public Star Home Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current envelope-only home page with a public animated star/bird scene that displays configured key称呼, uses Pretext for text layout, and reacts to new keys and new content.

**Architecture:** Keep keys private. The public home page reads only safe profile display data from a new public endpoint. Canvas renders the atmosphere and animation, while Pretext computes称呼 label geometry and line layout before Canvas draws the text. Server-side activity timestamps drive star/bird flashes.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Canvas 2D, `@chenglou/pretext`, better-sqlite3, Vitest, Playwright.

---

## Invariants

- Never expose the real key.
- Never expose `key_lookup_hash`, `created_ip_hash`, session token, or cookie data.
- Only configured profiles appear on the public home scene.
- The public label is `assistantName`.
- `assistantName` remains max 24 chars, trimmed, and validated by the existing profile API.
- A new key becomes visible only after `/setup` saves the称呼.
- The home page works without public stars.
- `prefers-reduced-motion: reduce` disables continuous motion and keeps one static composition.
- Dark mode renders galaxy/star visuals.
- Light mode renders blue-sky/cloud/bird visuals.

## Data Model

Add activity metadata to `key_profiles`:

```sql
activity_at TEXT
activity_kind TEXT
```

`activity_kind` values:

```ts
type KeyActivityKind = 'created' | 'profile' | 'chat' | 'design' | 'media'
```

Use `activity_at` to decide which star/bird should flash. Use `configured_at` to decide whether a profile is public.

---

### Task 1: Add Public Star Repository Methods

**Files:**
- Modify: `server/db/sqlite.ts`
- Modify: `server/db/schema.ts`
- Test: `server/db/sqlite.test.ts`

**Step 1: Write failing repository tests**

Add tests to `server/db/sqlite.test.ts`:

```ts
it('lists configured public stars without private key fields', () => {
  const repo = createKeyProfileRepository(':memory:')

  repo.addKeyProfile({
    id: 'key_1',
    keyLookupHash: 'lookup_1',
    assistantName: '阿月',
    mbti: 'INTJ',
    configuredAt: '2026-05-16T00:00:00.000Z',
    createdIpHash: 'ip_hash_1',
    createdAt: '2026-05-16T00:00:00.000Z',
    updatedAt: '2026-05-16T00:00:00.000Z',
    activityAt: '2026-05-16T00:01:00.000Z',
    activityKind: 'created',
  })
  repo.addKeyProfile({
    id: 'key_2',
    keyLookupHash: 'lookup_2',
    assistantName: '',
    mbti: '',
    configuredAt: null,
    createdIpHash: 'ip_hash_2',
    createdAt: '2026-05-16T00:02:00.000Z',
    updatedAt: '2026-05-16T00:02:00.000Z',
    activityAt: null,
    activityKind: null,
  })

  expect(repo.listPublicStars()).toEqual([
    {
      id: 'key_1',
      name: '阿月',
      mbti: 'INTJ',
      createdAt: '2026-05-16T00:00:00.000Z',
      activityAt: '2026-05-16T00:01:00.000Z',
      activityKind: 'created',
    },
  ])
})

it('marks key activity for public star flashes', () => {
  const repo = createKeyProfileRepository(':memory:')

  repo.addKeyProfile({
    id: 'key_1',
    keyLookupHash: 'lookup_1',
    assistantName: '阿月',
    mbti: 'INTJ',
    configuredAt: '2026-05-16T00:00:00.000Z',
    createdIpHash: 'ip_hash_1',
    createdAt: '2026-05-16T00:00:00.000Z',
    updatedAt: '2026-05-16T00:00:00.000Z',
    activityAt: null,
    activityKind: null,
  })

  repo.markKeyActivity('key_1', {
    activityAt: '2026-05-16T00:03:00.000Z',
    activityKind: 'chat',
  })

  expect(repo.listPublicStars()[0]).toMatchObject({
    id: 'key_1',
    activityAt: '2026-05-16T00:03:00.000Z',
    activityKind: 'chat',
  })
})
```

**Step 2: Run failing tests**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected: fail because `activityAt`, `activityKind`, `listPublicStars`, and `markKeyActivity` do not exist.

**Step 3: Update types and schema**

In `server/db/sqlite.ts`, extend `KeyProfileRecord`:

```ts
export type KeyActivityKind = 'created' | 'profile' | 'chat' | 'design' | 'media'

export type PublicStarRecord = {
  id: string
  name: string
  mbti: string
  createdAt: string
  activityAt?: string | null
  activityKind?: KeyActivityKind | null
}

export type KeyProfileRecord = {
  id: string
  keyLookupHash: string
  assistantName: string
  mbti: string
  configuredAt?: string | null
  createdIpHash: string
  createdAt: string
  updatedAt: string
  activityAt?: string | null
  activityKind?: KeyActivityKind | null
}
```

In `server/db/schema.ts`, add the columns to `key_profiles`:

```sql
activity_at TEXT,
activity_kind TEXT,
```

In `openDatabase`, add migrations:

```ts
ensureColumn(db, 'key_profiles', 'activity_at', 'TEXT')
ensureColumn(db, 'key_profiles', 'activity_kind', 'TEXT')
```

**Step 4: Update profile repository**

Update `addKeyProfile` insert/select queries to include:

```sql
activity_at,
activity_kind
```

and map:

```ts
activityAt: record.activityAt ?? null,
activityKind: record.activityKind ?? null,
```

Add methods:

```ts
listPublicStars(limit = 80): PublicStarRecord[] {
  return db.prepare(`
    SELECT
      id,
      assistant_name AS name,
      mbti,
      created_at AS createdAt,
      activity_at AS activityAt,
      activity_kind AS activityKind
    FROM key_profiles
    WHERE configured_at IS NOT NULL
      AND assistant_name <> ''
    ORDER BY COALESCE(activity_at, configured_at, created_at) DESC
    LIMIT ?
  `).all(limit) as PublicStarRecord[]
},

markKeyActivity(id: string, updates: { activityAt: string, activityKind: KeyActivityKind }) {
  db.prepare(`
    UPDATE key_profiles
    SET activity_at = @activityAt,
        activity_kind = @activityKind,
        updated_at = @activityAt
    WHERE id = @id
  `).run({ id, ...updates })
},
```

**Step 5: Run tests**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected: pass.

**Step 6: Commit**

```bash
git add server/db/schema.ts server/db/sqlite.ts server/db/sqlite.test.ts
git commit -m "feat: add public star profile repository"
```

---

### Task 2: Add Public Stars API

**Files:**
- Create: `server/api/public-stars.get.ts`
- Create: `server/api/public-stars.get.test.ts`
- Modify: `server/middleware/session.ts` if needed

**Step 1: Write pure mapper tests**

Create `server/api/public-stars.get.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mapPublicStar } from './public-stars.get'

describe('public stars api helpers', () => {
  it('maps only safe public fields', () => {
    expect(mapPublicStar({
      id: 'key_1',
      name: '阿月',
      mbti: 'INTJ',
      createdAt: '2026-05-16T00:00:00.000Z',
      activityAt: '2026-05-16T00:01:00.000Z',
      activityKind: 'chat',
    })).toEqual({
      id: 'key_1',
      name: '阿月',
      mbti: 'INTJ',
      createdAt: '2026-05-16T00:00:00.000Z',
      activityAt: '2026-05-16T00:01:00.000Z',
      activityKind: 'chat',
    })
  })
})
```

**Step 2: Run failing test**

Run:

```bash
npm run test -- server/api/public-stars.get.test.ts
```

Expected: fail because the file does not exist.

**Step 3: Implement API**

Create `server/api/public-stars.get.ts`:

```ts
import { defineEventHandler, getQuery } from 'h3'
import { createKeyProfileRepository, type PublicStarRecord } from '../db/sqlite'

export type PublicStarResponseItem = {
  id: string
  name: string
  mbti: string
  createdAt: string
  activityAt?: string | null
  activityKind?: PublicStarRecord['activityKind']
}

export function mapPublicStar(record: PublicStarRecord): PublicStarResponseItem {
  return {
    id: record.id,
    name: record.name,
    mbti: record.mbti,
    createdAt: record.createdAt,
    activityAt: record.activityAt ?? null,
    activityKind: record.activityKind ?? null,
  }
}

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const query = getQuery(event)
  const requestedLimit = Number(query.limit)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 120)
    : 80
  const stars = createKeyProfileRepository(config.sqlitePath).listPublicStars(limit)

  return {
    stars: stars.map(mapPublicStar),
  }
})
```

**Step 4: Ensure public API bypasses session middleware**

Check `server/middleware/session.ts`. It currently allows `/api/unlock` and `/api/keys` without a session. Add `/api/public-stars`:

```ts
if (
  !path.startsWith('/api/')
  || path === '/api/unlock'
  || path === '/api/keys'
  || path === '/api/public-stars'
) {
  return
}
```

**Step 5: Run tests**

Run:

```bash
npm run test -- server/api/public-stars.get.test.ts
```

Expected: pass.

**Step 6: Commit**

```bash
git add server/api/public-stars.get.ts server/api/public-stars.get.test.ts server/middleware/session.ts
git commit -m "feat: expose public star list"
```

---

### Task 3: Mark Profile Creation Activity

**Files:**
- Modify: `server/api/key/profile.put.ts`
- Modify: `server/api/key/profile.test.ts`
- Test: `server/db/sqlite.test.ts`

**Step 1: Add helper test**

In `server/api/key/profile.test.ts`, add:

```ts
import { resolveProfileActivityKind } from './profile.put'

it('marks first profile save as created activity', () => {
  expect(resolveProfileActivityKind(null)).toBe('created')
})

it('marks later profile save as profile activity', () => {
  expect(resolveProfileActivityKind('2026-05-16T00:00:00.000Z')).toBe('profile')
})
```

**Step 2: Run failing test**

Run:

```bash
npm run test -- server/api/key/profile.test.ts
```

Expected: fail because `resolveProfileActivityKind` does not exist.

**Step 3: Implement minimal helper and activity update**

In `server/api/key/profile.put.ts`:

```ts
export function resolveProfileActivityKind(configuredAt?: string | null) {
  return configuredAt ? 'profile' : 'created'
}
```

Before `repo.updateKeyProfile`, load current profile:

```ts
const current = repo.getKeyProfile(keyId)
const activityKind = resolveProfileActivityKind(current?.configuredAt)
```

After `repo.updateKeyProfile`, call:

```ts
repo.markKeyActivity(keyId, {
  activityAt: now,
  activityKind,
})
```

**Step 4: Run tests**

Run:

```bash
npm run test -- server/api/key/profile.test.ts server/db/sqlite.test.ts
```

Expected: pass.

**Step 5: Commit**

```bash
git add server/api/key/profile.put.ts server/api/key/profile.test.ts
git commit -m "feat: mark public star profile activity"
```

---

### Task 4: Mark Content Activity

**Files:**
- Modify: `server/api/chat/stream.post.ts`
- Modify: `server/api/design/commit.post.ts`
- Modify: `server/api/media.test.ts` if media tests cover API behavior
- Modify: `server/api/image.post.ts`
- Modify: `server/api/music.post.ts`
- Modify: `server/api/tts.post.ts`
- Modify: `server/api/video/tasks.post.ts`
- Test: existing API tests for touched routes where practical

**Step 1: Add small shared helper**

Prefer a local server helper over repeating repository code.

Create `server/services/key-activity.ts`:

```ts
import { createKeyProfileRepository, type KeyActivityKind } from '../db/sqlite'

export function markKeyActivity(path: string, keyId: string, activityKind: KeyActivityKind, now = new Date().toISOString()) {
  createKeyProfileRepository(path).markKeyActivity(keyId, {
    activityAt: now,
    activityKind,
  })
}
```

**Step 2: Add helper test**

Create `server/services/key-activity.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createKeyProfileRepository } from '../db/sqlite'
import { markKeyActivity } from './key-activity'

describe('key activity service', () => {
  it('updates public star activity', () => {
    const path = ':memory:'
    const repo = createKeyProfileRepository(path)

    repo.addKeyProfile({
      id: 'key_1',
      keyLookupHash: 'lookup_1',
      assistantName: '阿月',
      mbti: 'INTJ',
      configuredAt: '2026-05-16T00:00:00.000Z',
      createdIpHash: 'ip_hash_1',
      createdAt: '2026-05-16T00:00:00.000Z',
      updatedAt: '2026-05-16T00:00:00.000Z',
      activityAt: null,
      activityKind: null,
    })

    markKeyActivity(path, 'key_1', 'chat', '2026-05-16T00:10:00.000Z')

    expect(repo.listPublicStars()[0]).toMatchObject({
      activityAt: '2026-05-16T00:10:00.000Z',
      activityKind: 'chat',
    })
  })
})
```

**Step 3: Run failing/passing helper test**

Run:

```bash
npm run test -- server/services/key-activity.test.ts
```

Expected: pass after helper is implemented.

**Step 4: Wire chat activity**

In `server/api/chat/stream.post.ts`, after assistant content is persisted successfully:

```ts
markKeyActivity(config.sqlitePath, keyId, 'chat')
```

Use a `try/catch` if needed so activity update cannot break the chat response.

**Step 5: Wire design activity**

In `server/api/design/commit.post.ts`, after design commit succeeds:

```ts
markKeyActivity(config.sqlitePath, keyId, 'design')
```

**Step 6: Wire media activity**

In media creation endpoints, mark when a user starts a generation task:

```ts
markKeyActivity(config.sqlitePath, keyId, 'media')
```

Apply to routes that create user-visible media:

- `server/api/image.post.ts`
- `server/api/music.post.ts`
- `server/api/tts.post.ts`
- `server/api/video/tasks.post.ts`

**Step 7: Run relevant tests**

Run:

```bash
npm run test -- server/services/key-activity.test.ts server/api/chat.post.test.ts server/api/design.test.ts server/api/media.test.ts
```

Expected: pass. If one of these files does not cover the streaming endpoint, run the existing nearest test and add a pure helper test instead of broad integration work.

**Step 8: Commit**

```bash
git add server/services/key-activity.ts server/services/key-activity.test.ts server/api/chat/stream.post.ts server/api/design/commit.post.ts server/api/image.post.ts server/api/music.post.ts server/api/tts.post.ts server/api/video/tasks.post.ts
git commit -m "feat: mark public star activity from content"
```

---

### Task 5: Add Scene Layout Utilities

**Files:**
- Create: `utils/public-star-scene.ts`
- Create: `utils/public-star-scene.test.ts`

**Step 1: Write tests for deterministic layout**

Create `utils/public-star-scene.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createPublicStarEntities, resolveSceneMode } from './public-star-scene'

describe('public star scene utilities', () => {
  it('creates stable entities for public stars', () => {
    const entities = createPublicStarEntities([
      {
        id: 'key_1',
        name: '阿月',
        mbti: 'INTJ',
        createdAt: '2026-05-16T00:00:00.000Z',
        activityAt: '2026-05-16T00:01:00.000Z',
        activityKind: 'created',
      },
    ], { width: 1000, height: 700 })

    expect(entities[0]).toMatchObject({
      id: 'key_1',
      label: '阿月',
      activityKind: 'created',
    })
    expect(entities[0]?.x).toBeGreaterThanOrEqual(0)
    expect(entities[0]?.x).toBeLessThanOrEqual(1000)
    expect(entities[0]?.y).toBeGreaterThanOrEqual(0)
    expect(entities[0]?.y).toBeLessThanOrEqual(700)
  })

  it('resolves light and dark scene modes', () => {
    expect(resolveSceneMode(false)).toBe('sky')
    expect(resolveSceneMode(true)).toBe('galaxy')
  })
})
```

**Step 2: Run failing test**

Run:

```bash
npm run test -- utils/public-star-scene.test.ts
```

Expected: fail because utility file does not exist.

**Step 3: Implement utilities**

Create `utils/public-star-scene.ts`:

```ts
export type PublicStar = {
  id: string
  name: string
  mbti: string
  createdAt: string
  activityAt?: string | null
  activityKind?: 'created' | 'profile' | 'chat' | 'design' | 'media' | null
}

export type SceneBounds = {
  width: number
  height: number
}

export type PublicStarEntity = {
  id: string
  label: string
  x: number
  y: number
  seed: number
  orbit: number
  activityAt?: string | null
  activityKind?: PublicStar['activityKind']
}

export type PublicStarSceneMode = 'galaxy' | 'sky'

export function resolveSceneMode(prefersDark: boolean): PublicStarSceneMode {
  return prefersDark ? 'galaxy' : 'sky'
}

export function hashSeed(input: string) {
  let hash = 2166136261

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

export function createPublicStarEntities(stars: PublicStar[], bounds: SceneBounds): PublicStarEntity[] {
  const width = Math.max(320, bounds.width)
  const height = Math.max(420, bounds.height)
  const centerX = width / 2
  const centerY = height / 2
  const maxRadius = Math.min(width, height) * 0.42

  return stars.map((star, index) => {
    const seed = hashSeed(star.id)
    const angle = ((seed % 360) / 180) * Math.PI + index * 0.37
    const orbit = 0.28 + ((seed % 100) / 100) * 0.72
    const radius = maxRadius * orbit

    return {
      id: star.id,
      label: star.name,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius * 0.72,
      seed,
      orbit,
      activityAt: star.activityAt ?? null,
      activityKind: star.activityKind ?? null,
    }
  })
}
```

**Step 4: Run tests**

Run:

```bash
npm run test -- utils/public-star-scene.test.ts
```

Expected: pass.

**Step 5: Commit**

```bash
git add utils/public-star-scene.ts utils/public-star-scene.test.ts
git commit -m "feat: add public star scene layout utilities"
```

---

### Task 6: Build Canvas + Pretext Home Scene Component

**Files:**
- Create: `components/PublicStarHome.client.vue`
- Create: `components/PublicStarHome.test.ts`
- Modify: `assets/css/main.css`

**Step 1: Write component smoke test**

Create `components/PublicStarHome.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PublicStarHome from './PublicStarHome.client.vue'

describe('PublicStarHome', () => {
  it('renders the home scene shell and unlock gate slot', () => {
    const wrapper = mount(PublicStarHome, {
      props: {
        stars: [
          {
            id: 'key_1',
            name: '阿月',
            mbti: 'INTJ',
            createdAt: '2026-05-16T00:00:00.000Z',
            activityAt: '2026-05-16T00:01:00.000Z',
            activityKind: 'created',
          },
        ],
      },
      slots: {
        default: '<div class="gate-slot">gate</div>',
      },
    })

    expect(wrapper.find('.public-star-home').exists()).toBe(true)
    expect(wrapper.find('canvas').exists()).toBe(true)
    expect(wrapper.find('.gate-slot').exists()).toBe(true)
  })
})
```

**Step 2: Run failing test**

Run:

```bash
npm run test -- components/PublicStarHome.test.ts
```

Expected: fail because component does not exist.

**Step 3: Implement component shell**

Create `components/PublicStarHome.client.vue` with:

- `canvas` ref.
- Slot for existing `UnlockGate`.
- `stars` prop.
- `newStar` optional prop or public exposed method later.
- `ResizeObserver` or resize listener.
- `requestAnimationFrame` loop.
- media query listeners for dark mode and reduced motion.

Initial template:

```vue
<template>
  <section class="public-star-home" :data-mode="mode">
    <canvas ref="canvas" class="public-star-home__canvas" aria-hidden="true" />
    <div class="public-star-home__gate">
      <slot />
    </div>
  </section>
</template>
```

**Step 4: Add Pretext rendering path**

Use Pretext in the draw loop:

```ts
import {
  layoutWithLines,
  prepareWithSegments,
} from '@chenglou/pretext'
```

For each visible entity:

```ts
const prepared = prepareWithSegments(entity.label, font, { letterSpacing: 0 })
const result = layoutWithLines(prepared, 140, 22)

for (const [index, line] of result.lines.entries()) {
  context.fillText(line.text, entity.x, entity.y + index * 22)
}
```

Keep a small cache by `label + font` so `prepareWithSegments` does not rerun every frame.

**Step 5: Draw galaxy mode**

In dark mode:

- Deep background gradient.
- Small deterministic star field.
- Soft galaxy band.
- Each entity:
  - point glow
  - star pulse
  - Pretext label near point
  - activity flash when `activityAt` changes

**Step 6: Draw sky mode**

In light mode:

- Blue gradient.
- Soft cloud layers.
- Each entity:
  - small bird silhouette from Canvas paths
  - wing flap based on time
  - Pretext label near bird
  - activity flash as sunlight ring

**Step 7: Add reduced motion**

If reduced motion:

- Draw once after data/resizing.
- No continuous `requestAnimationFrame`.
- Keep stars/birds static.
- No flashing loop; render high-level static highlight only.

**Step 8: Add CSS**

In `assets/css/main.css`, add:

```css
.public-star-home {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  color: var(--ink);
}

.public-star-home__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.public-star-home__gate {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem 1.25rem;
}
```

Then scope existing `.unlock-gate` to work inside the new shell:

```css
.public-star-home .unlock-gate {
  min-height: auto;
  width: min(100%, 45rem);
  padding: 0;
}
```

**Step 9: Run component test**

Run:

```bash
npm run test -- components/PublicStarHome.test.ts
```

Expected: pass.

**Step 10: Commit**

```bash
git add components/PublicStarHome.client.vue components/PublicStarHome.test.ts assets/css/main.css
git commit -m "feat: add animated public star home scene"
```

---

### Task 7: Wire Home Page Data and New-Star Meteor

**Files:**
- Modify: `pages/index.vue`
- Modify: `components/UnlockGate.vue`
- Modify: `components/UnlockGate.test.ts`

**Step 1: Add min-length validation test**

In `components/UnlockGate.test.ts`, add:

```ts
it('requires new keys to be at least six characters', async () => {
  const createKey = vi.fn(async () => ({ ok: true, keyId: 'key_1', needsConfig: true }))
  const wrapper = mount(UnlockGate, {
    props: {
      unlock: async () => ({ ok: false }),
      createKey,
    },
  })

  await wrapper.get('button[aria-label="创建钥匙"]').trigger('click')
  await wrapper.find('input').setValue('12345')
  await wrapper.get('button[aria-label="保存钥匙"]').trigger('click')

  expect(createKey).not.toHaveBeenCalled()
  expect(wrapper.text()).toContain('钥匙至少需要 6 位。')
})
```

**Step 2: Run failing test**

Run:

```bash
npm run test -- components/UnlockGate.test.ts
```

Expected: fail because min-length validation does not exist.

**Step 3: Implement validation**

In `components/UnlockGate.vue`, before calling `props.createKey`:

```ts
if (mode.value === 'create' && code.value.trim().length < 6) {
  error.value = '钥匙至少需要 6 位。'
  pending.value = false
  return
}
```

Also set input `minlength` for create mode:

```vue
:minlength="mode === 'create' ? 6 : undefined"
```

**Step 4: Wire index page**

In `pages/index.vue`:

- Fetch public stars:

```ts
const { data, refresh } = await useFetch('/api/public-stars', {
  default: () => ({ stars: [] }),
})

const publicStars = computed(() => data.value?.stars ?? [])
```

- Wrap `UnlockGate` in `PublicStarHome`.
- After created/unlocked, keep current navigation behavior.
- After returning from `/setup`, public list will include the称呼. No key label is shown.

Template:

```vue
<ClientOnly>
  <PublicStarHome :stars="publicStars">
    <UnlockGate
      :unlock="unlock"
      :create-key="createKey"
      @unlocked="handleUnlocked"
      @created="handleCreated"
    />
  </PublicStarHome>
  <template #fallback>
    <UnlockGate
      :unlock="unlock"
      :create-key="createKey"
      @unlocked="handleUnlocked"
      @created="handleCreated"
    />
  </template>
</ClientOnly>
```

`handleCreated` can call `refresh()` before navigation if useful, but the new public star appears after setup saves the称呼. The meteor should be triggered on the first profile save, not raw key creation.

**Step 5: Run tests**

Run:

```bash
npm run test -- components/UnlockGate.test.ts
```

Expected: pass.

**Step 6: Commit**

```bash
git add pages/index.vue components/UnlockGate.vue components/UnlockGate.test.ts
git commit -m "feat: wire public star home entry"
```

---

### Task 8: Trigger Meteor After First Profile Save

**Files:**
- Modify: `pages/setup.vue`
- Modify: `components/PublicStarHome.client.vue`
- Optional create: `composables/usePublicStars.ts`

**Step 1: Decide event transport**

Use `localStorage` as a same-browser handoff:

- `/setup` saves profile.
- Before navigating to `/chat`, write:

```ts
localStorage.setItem('ysmjjsy:new-public-star', JSON.stringify({
  id: profile.keyId,
  name: profile.assistantName,
  at: new Date().toISOString(),
}))
```

- Home scene reads and consumes it if the user returns home.

This is only for local animation. Server state remains source of truth.

**Step 2: Implement scene consumption**

In `PublicStarHome.client.vue`:

- On mount, read `ysmjjsy:new-public-star`.
- If present and not expired, create a meteor/flying-bird animation.
- Remove the key from `localStorage` after consuming.

Expiry:

```ts
const maxAgeMs = 1000 * 60 * 5
```

**Step 3: Add minimal component test**

If jsdom localStorage is reliable in the current setup, add:

```ts
it('renders with stored new public star event', () => {
  localStorage.setItem('ysmjjsy:new-public-star', JSON.stringify({
    id: 'key_1',
    name: '阿月',
    at: new Date().toISOString(),
  }))

  const wrapper = mount(PublicStarHome, {
    props: { stars: [] },
  })

  expect(wrapper.find('.public-star-home').exists()).toBe(true)
  expect(localStorage.getItem('ysmjjsy:new-public-star')).toBeNull()
})
```

If canvas/jsdom makes this brittle, move parsing into a pure utility and test that instead.

**Step 4: Run tests**

Run:

```bash
npm run test -- components/PublicStarHome.test.ts
```

Expected: pass.

**Step 5: Commit**

```bash
git add pages/setup.vue components/PublicStarHome.client.vue components/PublicStarHome.test.ts
git commit -m "feat: animate first public star entry"
```

---

### Task 9: Add Activity Polling and Flash State

**Files:**
- Modify: `components/PublicStarHome.client.vue`
- Optional create: `composables/usePublicStars.ts`
- Test: `utils/public-star-scene.test.ts` or a new pure utility test

**Step 1: Add pure flash detector**

In `utils/public-star-scene.ts`:

```ts
export function findChangedActivityIds(previous: PublicStar[], next: PublicStar[]) {
  const previousById = new Map(previous.map(star => [star.id, star.activityAt ?? '']))

  return next
    .filter(star => (star.activityAt ?? '') !== (previousById.get(star.id) ?? ''))
    .map(star => star.id)
}
```

**Step 2: Test flash detector**

In `utils/public-star-scene.test.ts`:

```ts
it('finds stars with changed activity', () => {
  expect(findChangedActivityIds(
    [{ id: 'key_1', name: '阿月', mbti: 'INTJ', createdAt: 't0', activityAt: 't1' }],
    [{ id: 'key_1', name: '阿月', mbti: 'INTJ', createdAt: 't0', activityAt: 't2' }],
  )).toEqual(['key_1'])
})
```

**Step 3: Run failing test**

Run:

```bash
npm run test -- utils/public-star-scene.test.ts
```

Expected: fail until helper exists.

**Step 4: Poll public stars**

In `pages/index.vue` or `PublicStarHome.client.vue`, poll every 15 seconds:

```ts
const interval = window.setInterval(() => refresh(), 15_000)
```

Prefer `pages/index.vue` because it owns `useFetch`. Pass changed IDs to the scene:

```vue
<PublicStarHome :stars="publicStars" :flash-ids="flashIds">
```

**Step 5: Flash inside canvas**

`PublicStarHome.client.vue` should keep:

```ts
const flashes = new Map<string, number>()
```

When `flashIds` changes, store `performance.now()` for each id. During draw, compute flash alpha for 1.2s.

**Step 6: Run tests**

Run:

```bash
npm run test -- utils/public-star-scene.test.ts components/PublicStarHome.test.ts
```

Expected: pass.

**Step 7: Commit**

```bash
git add pages/index.vue components/PublicStarHome.client.vue utils/public-star-scene.ts utils/public-star-scene.test.ts
git commit -m "feat: flash public stars on activity"
```

---

### Task 10: Visual QA With Browser

**Files:**
- No planned source changes unless QA finds issues

**Step 1: Run full unit/build verification**

Run:

```bash
npm run test
npm run build
```

Expected: both pass.

**Step 2: Start local dev server**

Run:

```bash
npm run dev
```

Expected: Nuxt starts, usually on `http://localhost:3000`.

**Step 3: Browser checks**

Use Browser plugin or Playwright.

Check desktop:

- `http://localhost:3000`
- 1440 x 900
- Light mode screenshot
- Dark mode screenshot

Check mobile:

- 390 x 844
- Light mode screenshot
- Dark mode screenshot

Expected:

- Canvas is nonblank.
- Unlock form remains readable.
- No text overlaps the form.
- Long称呼 labels do not break layout.
- Reduced motion does not animate continuously.
- Light mode reads as sky/cloud/bird, not galaxy.
- Dark mode reads as galaxy/star, not blue sky.

**Step 4: E2E flow**

Run:

```bash
npm run test:e2e -- tests/e2e/main-flow.spec.ts
```

Expected: pass.

**Step 5: Fix one issue at a time**

If visual QA finds overlap or blank canvas:

1. Make the smallest CSS or drawing fix.
2. Re-run the failing check.
3. Re-run `npm run test -- components/PublicStarHome.test.ts`.

**Step 6: Commit fixes**

```bash
git add <changed-files>
git commit -m "fix: polish public star home layout"
```

---

### Task 11: Local Code Review and Security Review

**Files:**
- No planned source changes unless review finds issues

**Step 1: Code review checklist**

Review these files:

- `server/api/public-stars.get.ts`
- `server/db/sqlite.ts`
- `server/api/key/profile.put.ts`
- `server/services/key-activity.ts`
- `components/PublicStarHome.client.vue`
- `pages/index.vue`
- `pages/setup.vue`

Check:

- No private fields in API response.
- Public endpoint has a hard limit.
- Canvas loop is cancelled on unmount.
- Resize/media listeners are removed on unmount.
- Pretext prepared text is cached by label/font.
- Reduced motion is respected.
- Empty public stars state works.
- Long labels are bounded.

**Step 2: Security review checklist**

Check:

- No key values appear in public API.
- No lookup hashes appear in public API.
- No IP hashes appear in public API.
- Public stars do not require session.
- Public stars include only user-provided称呼, MBTI, timestamps, activity kind.
-称呼 display is text-only and rendered through Canvas; no HTML injection path.
- `localStorage` event contains only public `id`, `name`, `at`.

**Step 3: Run final verification**

Run:

```bash
npm run check
```

Expected: pass.

**Step 4: Final commit if any review fixes were made**

```bash
git add <changed-files>
git commit -m "fix: address public star home review"
```

---

## Rollout Notes

- Existing keys without configured称呼 stay hidden on the public home page.
- Existing configured profiles will appear after migration, but `activity_at` may be empty until the next profile/content event.
- If there are too many public stars, the endpoint caps at 120 and defaults to 80.
- The first implementation should not add SSE. Polling is enough for the home page.
- The first implementation should not use WebGL. Canvas 2D is enough and easier to verify.

## Final Verification Commands

```bash
npm run test
npm run build
npm run test:e2e -- tests/e2e/main-flow.spec.ts
```

## Expected Final Files

Created:

- `server/api/public-stars.get.ts`
- `server/api/public-stars.get.test.ts`
- `server/services/key-activity.ts`
- `server/services/key-activity.test.ts`
- `utils/public-star-scene.ts`
- `utils/public-star-scene.test.ts`
- `components/PublicStarHome.client.vue`
- `components/PublicStarHome.test.ts`

Modified:

- `server/db/schema.ts`
- `server/db/sqlite.ts`
- `server/db/sqlite.test.ts`
- `server/middleware/session.ts`
- `server/api/key/profile.put.ts`
- `server/api/key/profile.test.ts`
- `server/api/chat/stream.post.ts`
- `server/api/design/commit.post.ts`
- `server/api/image.post.ts`
- `server/api/music.post.ts`
- `server/api/tts.post.ts`
- `server/api/video/tasks.post.ts`
- `components/UnlockGate.vue`
- `components/UnlockGate.test.ts`
- `components/PublicStarHome.client.vue`
- `pages/index.vue`
- `pages/setup.vue`
- `assets/css/main.css`

---

## Checkpoints

### Checkpoint Task 1 - 2026-05-16

- Added `activity_at` and `activity_kind` to `key_profiles`.
- Added repository types for public star records and activity kinds.
- Added `listPublicStars()` and `markKeyActivity()` to `createKeyProfileRepository`.
- Added tests for public configured profile listing and activity updates.
- Verification: `npm run test -- server/db/sqlite.test.ts` passed.

### Checkpoint Task 2 - 2026-05-16

- Added `GET /api/public-stars`.
- Added `mapPublicStar()` so the response contains only safe public fields.
- Updated session middleware to allow `/api/public-stars` without a key session.
- Added API helper test for public field mapping.
- Verification: `npm run test -- server/api/public-stars.get.test.ts` passed.

### Checkpoint Task 3 - 2026-05-16

- Added `resolveProfileActivityKind()`.
- Profile first save now marks public star activity as `created`.
- Later profile updates mark public star activity as `profile`.
- Added tests for activity kind resolution.
- Verification: `npm run test -- server/api/key/profile.test.ts server/db/sqlite.test.ts` passed.

### Checkpoint Task 4 - 2026-05-16

- Added `server/services/key-activity.ts`.
- Added a temp-file sqlite test for cross-repository activity updates.
- Marked chat replies as `chat` activity after assistant persistence.
- Marked design commits as `design` activity.
- Marked image, music, TTS, and video task creation as `media` activity after successful provider work.
- Verification: `npm run test -- server/services/key-activity.test.ts server/api/chat.post.test.ts server/api/design.test.ts server/api/media.test.ts` passed.

### Checkpoint Task 5 - 2026-05-16

- Added `utils/public-star-scene.ts`.
- Added stable public star entity layout from id-based seeds.
- Added dark/light scene mode resolution.
- Added activity-change detection for flash triggering.
- Verification: `npm run test -- utils/public-star-scene.test.ts` passed.

### Checkpoint Task 6 - 2026-05-16

- Added `components/PublicStarHome.client.vue`.
- Added Canvas galaxy and sky rendering paths.
- Used Pretext to layout public称呼 labels before Canvas text rendering.
- Added flash support through `flashIds`.
- Added reduced-motion handling and cleanup for animation, resize, and media-query listeners.
- Added shell CSS so the existing unlock gate can sit above the animated scene.
- Added component smoke test.
- Verification: `npm run test -- components/PublicStarHome.test.ts` passed.

### Checkpoint Task 7 - 2026-05-16

- Added client-side new-key minimum length validation in `UnlockGate`.
- Added `minlength` for create mode input.
- Wired `pages/index.vue` to fetch `/api/public-stars`.
- Wrapped the unlock gate with `PublicStarHome` inside `ClientOnly`.
- Kept SSR fallback as the existing unlock gate.
- Verification: `npm run test -- components/UnlockGate.test.ts components/PublicStarHome.test.ts` passed.

### Checkpoint Task 8 - 2026-05-16

- `pages/setup.vue` now writes a short-lived `ysmjjsy:new-public-star` localStorage event after称呼保存.
- `PublicStarHome` consumes and removes the stored event on mount.
- Added dark-mode meteor and light-mode flying-bird entry animation for the first public称呼.
- Added a component test for localStorage event consumption.
- Verification: `npm run test -- components/PublicStarHome.test.ts` passed.

### Checkpoint Task 9 - 2026-05-16

- `pages/index.vue` now polls `/api/public-stars` every 15 seconds.
- Added page-level activity diffing with `findChangedActivityIds()`.
- Passed changed activity ids into `PublicStarHome` as `flashIds`.
- `PublicStarHome` already renders those ids as short star/bird flashes.
- Verification: `npm run test -- utils/public-star-scene.test.ts components/PublicStarHome.test.ts` passed.

### Checkpoint Task 10 - 2026-05-16

- Ran full unit/build verification with `npm run check`.
- Ran e2e main flow with `npm run test:e2e -- tests/e2e/main-flow.spec.ts`.
- Used system Google Chrome through Playwright against `http://127.0.0.1:3001`.
- Captured visual QA screenshots:
  - `/tmp/public-star-home-desktop-light.png`
  - `/tmp/public-star-home-desktop-dark.png`
  - `/tmp/public-star-home-mobile-light.png`
  - `/tmp/public-star-home-mobile-dark.png`
- Verified desktop/mobile light and dark canvases are nonblank, unlock input remains visible, and reduced motion stays static.
- Verification: `npm run check` passed, `npm run test:e2e -- tests/e2e/main-flow.spec.ts` passed, Chrome visual metrics passed.

### Checkpoint Task 11 - 2026-05-16

- Reviewed public API response fields for private data exposure.
- Reviewed public scene cleanup for animation frame, resize listener, media-query listener, Pretext cache, reduced motion, empty stars, and bounded labels.
- Reviewed localStorage new-star event payload.
- Found and fixed a review issue: server-side key creation still allowed keys shorter than 6 characters.
- Added `parseCreateKeyBody()` and a unit test for the 6-character minimum.
- Confirmed `/api/public-stars` exposes only `id`, `name`, `mbti`, `createdAt`, `activityAt`, and `activityKind`.
- Verification: `npm run test -- server/api/keys.post.test.ts components/UnlockGate.test.ts` passed, `npm run check` passed, `git diff --check` passed, `npm run test:e2e -- tests/e2e/main-flow.spec.ts` passed.

### Checkpoint Post-QA Full-Screen Spread - 2026-05-16

- Replaced center-clamp placement with top, bottom, left, and right visible-band distribution.
- Added a scene utility test to prove public称呼 entities spread across screen bands.
- Extended the new public称呼 entry animation so the meteor/bird travels from outside one side of the viewport to outside the other side.
- Verified Chrome screenshots:
  - `/tmp/public-star-home-spread-light.png`
  - `/tmp/public-star-home-spread-dark.png`
- Verification: `npm run test -- utils/public-star-scene.test.ts components/PublicStarHome.test.ts` passed, `npm run check` passed, `git diff --check` passed.

### Checkpoint Post-QA Minimal Unlock Gate - 2026-05-16

- Removed the home unlock title, description, stamp, flap, and envelope composition.
- Simplified `UnlockGate` to one key input with two actions: `进入` and `创建钥匙`.
- Updated component tests and the main e2e flow for the new direct create/enter actions.
- Verified Chrome screenshots:
  - `/tmp/unlock-gate-simple-light.png`
  - `/tmp/unlock-gate-simple-dark.png`
- Verification: `npm run test -- components/UnlockGate.test.ts components/PublicStarHome.test.ts` passed, `npm run check` passed, `git diff --check` passed, `npm run test:e2e -- tests/e2e/main-flow.spec.ts` passed.

### Checkpoint Post-QA Flying Birds - 2026-05-16

- Added `createFlyingBirdEntities()` for light-mode bird movement.
- Light mode now computes bird positions from time so birds fly from off-screen left to off-screen right.
- Dark mode still uses the static seeded star layout, so public stars stay in place.
- Added a scene utility test proving bird x positions change over time.
- Stabilized the e2e image mock with an inline data URL so image visibility no longer depends on `example.com`.
- Verified Chrome screenshots:
  - `/tmp/public-star-birds-flight-1.png`
  - `/tmp/public-star-birds-flight-2.png`
  - `/tmp/public-star-static-stars-dark.png`
- Verification: `npm run test -- utils/public-star-scene.test.ts components/PublicStarHome.test.ts` passed, `npm run check` passed, `git diff --check` passed, `npm run test:e2e -- tests/e2e/main-flow.spec.ts` passed.

### Checkpoint Post-QA Home Title And Bird Label Fade - 2026-05-16

- Added the home title `余生梦见皆是缘` above the minimal unlock entry.
- Wrapped the unlock gate in `.home-entry` so the title and controls behave as one centered entrance.
- Updated light-mode bird labels to fade near the title/input protected area and screen edges.
- Kept dark-mode stars static with the existing Pretext label rendering.
- Verified Chrome screenshots:
  - `/tmp/home-title-bird-labels-light-1.png`
  - `/tmp/home-title-bird-labels-light-2.png`
  - `/tmp/home-title-static-stars-dark.png`
  - `/tmp/home-title-mobile-light.png`
- Verification: `npm run test -- components/PublicStarHome.test.ts utils/public-star-scene.test.ts components/UnlockGate.test.ts` passed, `npm run check` passed, `git diff --check` passed, `npm run test:e2e -- tests/e2e/main-flow.spec.ts` passed.

### Checkpoint Post-QA Dark Star Center Spread - 2026-05-16

- Reduced the dark-mode center exclusion area so stars spread closer to the entrance.
- Added two deterministic center-sprinkle lanes to the dark-mode star layout.
- Kept labels protected by the existing occupied-label area while allowing star dots to appear near the middle.
- Added a scene utility assertion for central dark-mode star placement.
- Verified Browser screenshot:
  - `/tmp/home-dark-stars-center-spread.png`
- Verification: `npm run test -- utils/public-star-scene.test.ts components/PublicStarHome.test.ts` passed, `npm run check` passed.
