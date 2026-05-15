# 520 Confession Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a static frontend confession site where a quiet letter gradually turns into a ceremonial starry finale.

**Architecture:** Use a Vite React app with local content data, scene components, Framer Motion transitions, Pretext-based special paragraphs, and a custom Canvas star finale. Keep all user-facing copy and images in local data files so the project can be personalized without changing scene logic.

**Tech Stack:** Vite, React, TypeScript, Tailwind CSS, Framer Motion, `@chenglou/pretext`, Canvas, `lucide-react`, Vitest, Playwright.

---

### Task 1: Scaffold Frontend App

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`

**Step 1: Create the Vite React TypeScript project files**

Use Vite with React and TypeScript.
Do not add routing.
This is a single-page experience.

**Step 2: Install dependencies**

Run:

```bash
npm install
npm install framer-motion @chenglou/pretext lucide-react
npm install -D vite typescript react react-dom @types/react @types/react-dom @vitejs/plugin-react tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom playwright
```

**Step 3: Add scripts**

`package.json` scripts:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "check": "npm run test && npm run build"
}
```

**Step 4: Verify scaffold**

Run:

```bash
npm run build
```

Expected:

- TypeScript passes.
- Vite writes `dist`.

**Step 5: Commit**

```bash
git add package.json package-lock.json index.html tsconfig.json tsconfig.node.json vite.config.ts src
git commit -m "chore: scaffold frontend app"
```

---

### Task 2: Add Content Model

**Files:**
- Create: `src/content/loveLetter.ts`
- Create: `src/content/loveLetter.test.ts`

**Step 1: Write the content test**

```ts
import { letterParagraphs, memoryMoments } from './loveLetter'

describe('love letter content', () => {
  it('has short letter paragraphs', () => {
    expect(letterParagraphs.length).toBeGreaterThanOrEqual(4)
    expect(letterParagraphs.every((item) => item.text.length <= 120)).toBe(true)
  })

  it('has a small set of memory moments', () => {
    expect(memoryMoments.length).toBeGreaterThanOrEqual(3)
    expect(memoryMoments.length).toBeLessThanOrEqual(5)
  })
})
```

**Step 2: Run test and verify failure**

Run:

```bash
npm run test -- src/content/loveLetter.test.ts
```

Expected:

- FAIL because content file does not exist.

**Step 3: Implement local content**

Create:

```ts
export type LetterParagraph = {
  id: string
  text: string
  layout?: 'normal' | 'heart-wrap' | 'date-wrap' | 'photo-wrap'
}

export type MemoryMoment = {
  id: string
  date: string
  text: string
  image?: string
}

export const letterParagraphs: LetterParagraph[] = [
  {
    id: 'opening',
    text: '有些话放在心里很久，今天想认真写给你。',
    layout: 'normal',
  },
  {
    id: 'quiet',
    text: '喜欢不是突然发生的，是很多个很小的瞬间，慢慢有了方向。',
    layout: 'heart-wrap',
  },
  {
    id: 'memory',
    text: '想到你时，很多普通的日子会变得柔软一点。',
    layout: 'date-wrap',
  },
  {
    id: 'turn',
    text: '如果可以，我想把之后很多个平常日子，都认真留给你。',
    layout: 'normal',
  },
]

export const memoryMoments: MemoryMoment[] = [
  { id: 'first', date: '某一天', text: '第一次发现自己会期待你的消息。' },
  { id: 'smile', date: '某个瞬间', text: '你笑起来的时候，世界会安静一点。' },
  { id: 'today', date: '5.20', text: '今天想把这句话说得正式一点。' },
]

export const finalConfession = {
  title: '我喜欢你',
  subtitle: '不是今天才开始，只是今天想认真告诉你。',
  cta: '一起吃顿饭吗',
}
```

**Step 4: Run test**

Run:

```bash
npm run test -- src/content/loveLetter.test.ts
```

Expected:

- PASS.

**Step 5: Commit**

```bash
git add src/content
git commit -m "feat: add love letter content model"
```

---

### Task 3: Build Base Theme And App Shell

**Files:**
- Modify: `src/styles.css`
- Modify: `src/App.tsx`
- Create: `src/components/AppShell.tsx`
- Create: `src/components/AppShell.test.tsx`

**Step 1: Write render test**

```tsx
import { render, screen } from '@testing-library/react'
import { AppShell } from './AppShell'

describe('AppShell', () => {
  it('renders the page title and children', () => {
    render(
      <AppShell>
        <p>Letter body</p>
      </AppShell>,
    )

    expect(screen.getByText('给你的信')).toBeInTheDocument()
    expect(screen.getByText('Letter body')).toBeInTheDocument()
  })
})
```

**Step 2: Run test and verify failure**

Run:

```bash
npm run test -- src/components/AppShell.test.tsx
```

Expected:

- FAIL because component does not exist.

**Step 3: Implement `AppShell`**

Use:

- full viewport min height
- warm paper background
- fixed subtle noise overlay through CSS
- constrained content width
- no card nesting

**Step 4: Add global styles**

Set:

- `body` margin reset
- warm background variables
- readable Chinese font stack
- selection color
- `prefers-reduced-motion` fallback

**Step 5: Run test and build**

Run:

```bash
npm run test -- src/components/AppShell.test.tsx
npm run build
```

Expected:

- PASS.
- Build succeeds.

**Step 6: Commit**

```bash
git add src/App.tsx src/styles.css src/components
git commit -m "feat: add app shell and base theme"
```

---

### Task 4: Build Cover Scene

**Files:**
- Create: `src/components/CoverScene.tsx`
- Create: `src/components/CoverScene.test.tsx`
- Modify: `src/App.tsx`

**Step 1: Write interaction test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { CoverScene } from './CoverScene'

describe('CoverScene', () => {
  it('calls enter handler when the user opens the letter', () => {
    const onEnter = vi.fn()
    render(<CoverScene onEnter={onEnter} />)

    fireEvent.click(screen.getByRole('button', { name: '打开这封信' }))

    expect(onEnter).toHaveBeenCalledTimes(1)
  })
})
```

**Step 2: Run test and verify failure**

Run:

```bash
npm run test -- src/components/CoverScene.test.tsx
```

Expected:

- FAIL because component does not exist.

**Step 3: Implement `CoverScene`**

Use:

- letter paper surface
- small date mark `5.20`
- one sentence
- understated button
- `lucide-react` icon inside button
- Framer Motion fade and slight lift

Reference component source only if useful:

- Magic UI shimmer button, rewritten to match the quiet theme.

**Step 4: Wire scene state**

In `App.tsx`, keep a simple state:

```ts
const [entered, setEntered] = useState(false)
```

Show `CoverScene` before entry.

**Step 5: Run test and build**

Run:

```bash
npm run test -- src/components/CoverScene.test.tsx
npm run build
```

Expected:

- PASS.
- Build succeeds.

**Step 6: Commit**

```bash
git add src/App.tsx src/components/CoverScene.tsx src/components/CoverScene.test.tsx
git commit -m "feat: add cover scene"
```

---

### Task 5: Build Letter Scene

**Files:**
- Create: `src/components/LetterScene.tsx`
- Create: `src/components/LetterScene.test.tsx`
- Modify: `src/App.tsx`

**Step 1: Write render test**

```tsx
import { render, screen } from '@testing-library/react'
import { LetterScene } from './LetterScene'
import { letterParagraphs, memoryMoments } from '../content/loveLetter'

describe('LetterScene', () => {
  it('renders the letter paragraphs and memory moments', () => {
    render(<LetterScene paragraphs={letterParagraphs} moments={memoryMoments} />)

    expect(screen.getByText(letterParagraphs[0].text)).toBeInTheDocument()
    expect(screen.getByText(memoryMoments[0].text)).toBeInTheDocument()
  })
})
```

**Step 2: Run test and verify failure**

Run:

```bash
npm run test -- src/components/LetterScene.test.tsx
```

Expected:

- FAIL because component does not exist.

**Step 3: Implement `LetterScene`**

Use:

- vertical reading flow
- short paragraphs
- memory moments after the first 2-3 paragraphs
- no carousel
- no grid wall
- responsive max width

**Step 4: Add motion**

Use Framer Motion:

- paragraph fade-in
- memory moment slight reveal
- no fast scale animation

**Step 5: Run test and build**

Run:

```bash
npm run test -- src/components/LetterScene.test.tsx
npm run build
```

Expected:

- PASS.
- Build succeeds.

**Step 6: Commit**

```bash
git add src/App.tsx src/components/LetterScene.tsx src/components/LetterScene.test.tsx
git commit -m "feat: add letter scene"
```

---

### Task 6: Add Pretext Paragraph Rendering

**Files:**
- Create: `src/lib/pretextLayout.ts`
- Create: `src/lib/pretextLayout.test.ts`
- Create: `src/components/PretextParagraph.tsx`
- Modify: `src/components/LetterScene.tsx`

**Step 1: Write layout helper test**

```ts
import { getPretextShape } from './pretextLayout'

describe('getPretextShape', () => {
  it('returns no obstacle for normal layout', () => {
    expect(getPretextShape('normal')).toBeNull()
  })

  it('returns an obstacle for heart layout', () => {
    expect(getPretextShape('heart-wrap')).not.toBeNull()
  })
})
```

**Step 2: Run test and verify failure**

Run:

```bash
npm run test -- src/lib/pretextLayout.test.ts
```

Expected:

- FAIL because helper does not exist.

**Step 3: Implement layout helper**

Keep this thin.
Do not hide Pretext behind a large abstraction.

Return shape definitions for:

- `heart-wrap`
- `date-wrap`
- `photo-wrap`

**Step 4: Implement `PretextParagraph`**

Use `@chenglou/pretext` for special layouts.
Fallback to normal `<p>` if measurement fails.

Requirements:

- no blank text on resize
- no runtime crash if Pretext changes API shape
- normal paragraph works without canvas

**Step 5: Replace paragraph rendering**

In `LetterScene`, render each paragraph through `PretextParagraph`.

**Step 6: Run tests and build**

Run:

```bash
npm run test -- src/lib/pretextLayout.test.ts src/components/LetterScene.test.tsx
npm run build
```

Expected:

- PASS.
- Build succeeds.

**Step 7: Commit**

```bash
git add src/lib src/components/PretextParagraph.tsx src/components/LetterScene.tsx
git commit -m "feat: add pretext paragraph layouts"
```

---

### Task 7: Add Star Transition And Finale

**Files:**
- Create: `src/lib/starMap.ts`
- Create: `src/lib/starMap.test.ts`
- Create: `src/components/StarTransition.tsx`
- Create: `src/components/StarMapFinale.tsx`
- Modify: `src/App.tsx`

**Step 1: Write star map test**

```ts
import { create520StarPoints } from './starMap'

describe('create520StarPoints', () => {
  it('creates deterministic points inside the viewport', () => {
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
npm run test -- src/lib/starMap.test.ts
```

Expected:

- FAIL because helper does not exist.

**Step 3: Implement star map helper**

Generate deterministic points for `520`.
Keep it data-driven.
No random-only final shape.

**Step 4: Implement `StarTransition`**

Use a full-width transition band.
Warm paper tones fade into night tones.
Small particles move slowly.

Reference component source only if useful:

- Magic UI particles
- Animata reveal primitives

**Step 5: Implement `StarMapFinale`**

Canvas requirements:

- handles high-DPI screens
- redraws on resize
- uses `requestAnimationFrame`
- cancels animation on unmount
- respects `prefers-reduced-motion`
- shows text fallback if Canvas is unavailable

**Step 6: Wire into app**

Render after `LetterScene`.
Use content from `finalConfession`.

**Step 7: Run tests and build**

Run:

```bash
npm run test -- src/lib/starMap.test.ts
npm run build
```

Expected:

- PASS.
- Build succeeds.

**Step 8: Commit**

```bash
git add src/lib src/components/StarTransition.tsx src/components/StarMapFinale.tsx src/App.tsx
git commit -m "feat: add starry confession finale"
```

---

### Task 8: Responsive Polish And Accessibility

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/*.tsx`
- Create: `tests/visual.spec.ts`

**Step 1: Add Playwright smoke test**

```ts
import { test, expect } from '@playwright/test'

test('renders cover and letter flow', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: '打开这封信' })).toBeVisible()
  await page.getByRole('button', { name: '打开这封信' }).click()
  await expect(page.getByText('有些话放在心里很久')).toBeVisible()
})
```

**Step 2: Add Playwright config if needed**

Create `playwright.config.ts`.
Use Vite dev server.

**Step 3: Run Playwright and verify current issues**

Run:

```bash
npx playwright test
```

Expected:

- It may fail before final wiring.
- Fix only actual layout or selector issues.

**Step 4: Polish responsive layout**

Check:

- 390px mobile width
- 768px tablet width
- 1440px desktop width

Fix:

- text overflow
- cramped button
- canvas height
- memory moment spacing
- letter paper width

**Step 5: Run full check**

Run:

```bash
npm run test
npm run build
npx playwright test
```

Expected:

- All pass.

**Step 6: Commit**

```bash
git add src tests playwright.config.ts
git commit -m "test: add responsive smoke coverage"
```

---

### Task 9: Deployment Notes

**Files:**
- Create: `README.md`

**Step 1: Document local commands**

Include:

```bash
npm install
npm run dev
npm run build
npm run preview
```

**Step 2: Document static deployment**

Include:

- upload `dist`
- Nginx root example
- SPA fallback to `index.html`

**Step 3: Verify build output**

Run:

```bash
npm run build
npm run preview -- --host 127.0.0.1
```

Open preview in browser.
Check cover, letter, star finale.

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add deployment notes"
```

---

### Task 10: Final Review

**Files:**
- Review all changed files.

**Step 1: Run full verification**

Run:

```bash
npm run check
npx playwright test
```

Expected:

- All pass.

**Step 2: Run code review**

Use `/code-review-expert`.

Focus:

- visual regressions
- mobile layout
- Canvas cleanup
- Pretext fallback
- static deployment issues

**Step 3: Security review**

Only needed if later user input, analytics, forms, tracking, or external image uploads are added.
For the current static version, skip.

**Step 4: Commit review fixes**

```bash
git add .
git commit -m "fix: address review feedback"
```

Only commit if there are actual fixes.
