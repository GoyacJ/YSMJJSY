# Natural Language Tool Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make chat tool use reliably follow natural language by retrieving candidate tools, requiring structured planner decisions, and executing valid tool plans through the existing task queue.

**Architecture:** Extend the current tool registry metadata, upgrade deterministic tool search, add a structured planner decision schema, and wire chat planning through candidate retrieval before execution. Keep the existing `tool catalog + planner + task queue + executor + chatParts` chain; do not add a refusal-correction layer or restore old `intent` routing.

**Tech Stack:** Nuxt 4, Nitro server routes, TypeScript, Zod, better-sqlite3, Vitest, Vue Test Utils, Playwright, MiniMax provider abstraction.

---

## Execution Rules

- Do not restore media shortcut buttons.
- Do not restore `intent` request fields.
- Do not add backend semantic correction rules.
- Keep tool execution inside existing task queue and policy.
- Use TDD for every behavior change.
- Keep edits scoped to tool planning and directly related tests.
- Preserve dirty worktree changes that are unrelated to this plan.

## Baseline Check

Run:

```bash
git status --short
npm run test -- server/services/agent-runtime.test.ts server/services/agent-tool-catalog.test.ts server/services/star-agent-tools.test.ts server/services/star-chat-planner.test.ts server/services/star-chat-tool-execution.test.ts server/api/chat.post.test.ts components/StarChat.test.ts components/StarChatMessage.test.ts components/StarComposer.test.ts
npm run build
```

Expected:

- Existing focused tests pass before behavior changes.
- Build passes before behavior changes.
- Dirty files are noted and not reverted.

---

## Phase 1: Tool Metadata

### Task 1: Add Capability Metadata Types

**Files:**

- Modify: `server/services/agent-runtime.ts`
- Test: `server/services/agent-runtime.test.ts`

**Goal:** Add typed metadata needed for natural language planning.

**Step 1: Write failing tests**

Add a registry test:

```ts
it('lists capability metadata for registered tools', () => {
  const registry = createAgentToolRegistry()

  registry.register({
    name: 'star.generateMusic',
    description: 'Generate music.',
    category: 'media',
    behavior: 'create',
    capabilities: ['generate_music', 'generate_song'],
    aliases: ['唱首歌'],
    whenToUse: '用户要求唱歌或生成音乐时使用。',
    cannotDo: '不保证实时真人演唱。',
    outputTypes: ['music'],
    execute: async () => ({ ok: true }),
  })

  expect(registry.list()[0]).toMatchObject({
    name: 'star.generateMusic',
    capabilities: ['generate_music', 'generate_song'],
    cannotDo: '不保证实时真人演唱。',
    outputTypes: ['music'],
  })
})
```

**Step 2: Run test to verify failure**

```bash
npm run test -- server/services/agent-runtime.test.ts
```

Expected:

- FAIL because `capabilities`, `cannotDo`, or `outputTypes` are not typed/listed.

**Step 3: Implement metadata types**

Add:

```ts
export type AgentToolCapability =
  | 'text_to_speech'
  | 'generate_image'
  | 'generate_music'
  | 'generate_song'
  | 'generate_video'
  | 'search_memory'
  | 'search_work'
  | 'preview_design'
  | 'commit_design'
  | 'publish_work'
  | 'govern_memory'
  | 'sleep_review'

export type AgentToolOutputType =
  | 'text'
  | 'status'
  | 'audio'
  | 'image'
  | 'music'
  | 'video'
```

Extend `AgentToolDefinition` with:

```ts
capabilities?: AgentToolCapability[]
cannotDo?: string
outputTypes?: AgentToolOutputType[]
```

Keep fields optional.

**Step 4: Run test**

```bash
npm run test -- server/services/agent-runtime.test.ts
```

Expected:

- PASS.

### Task 2: Update Star Tool Metadata

**Files:**

- Modify: `server/services/star-agent-tools.ts`
- Test: `server/services/star-agent-tools.test.ts`

**Goal:** Make music, speech, image, and video tools understandable from natural language.

**Step 1: Write failing tests**

Add assertions:

```ts
it('describes music generation as song and music capability', () => {
  const registry = createAgentToolRegistry()
  registerStarAgentTools(registry, testContext)

  expect(registry.list().find(tool => tool.name === 'star.generateMusic')).toMatchObject({
    capabilities: ['generate_music', 'generate_song'],
    aliases: expect.arrayContaining(['唱首歌', '制作音乐', '生成音乐']),
    outputTypes: ['music'],
  })
})

it('describes speech as text to speech, not singing', () => {
  const registry = createAgentToolRegistry()
  registerStarAgentTools(registry, testContext)

  expect(registry.list().find(tool => tool.name === 'star.speakReply')).toMatchObject({
    capabilities: ['text_to_speech'],
    aliases: expect.arrayContaining(['读给我听', '念给我听']),
    cannotDo: expect.stringContaining('不是唱歌工具'),
    outputTypes: ['audio'],
  })
})
```

**Step 2: Run test to verify failure**

```bash
npm run test -- server/services/star-agent-tools.test.ts
```

Expected:

- FAIL because metadata is incomplete.

**Step 3: Add metadata**

Update these tools:

- `star.speakReply`
- `star.generateImage`
- `star.generateMusic`
- `star.generateVideo`
- `star.searchMemories`
- `star.searchWorks`
- `star.previewDesign`
- `star.commitDesign`
- `star.publishWork`
- `star.governMemory`
- `star.sleep`

Use controlled capabilities only.

**Step 4: Run test**

```bash
npm run test -- server/services/star-agent-tools.test.ts
```

Expected:

- PASS.

---

## Phase 2: Candidate Retrieval

### Task 3: Upgrade Tool Catalog Search Scoring

**Files:**

- Modify: `server/services/agent-tool-catalog.ts`
- Test: `server/services/agent-tool-catalog.test.ts`

**Goal:** Search by natural language aliases and controlled capabilities.

**Step 1: Write failing tests**

Add tests:

```ts
it('finds music generation from singing language', () => {
  const results = searchAgentTools({
    tools: [
      musicTool,
      speechTool,
    ],
    query: '唱首歌给我听',
    category: 'media',
    behavior: 'create',
  })

  expect(results[0].name).toBe('star.generateMusic')
})

it('finds speech from read-aloud language', () => {
  const results = searchAgentTools({
    tools: [
      musicTool,
      speechTool,
    ],
    query: '把这句话读给我听',
  })

  expect(results[0].name).toBe('star.speakReply')
})
```

**Step 2: Run test to verify failure**

```bash
npm run test -- server/services/agent-tool-catalog.test.ts
```

Expected:

- FAIL if current scoring cannot rank these correctly.

**Step 3: Implement scoring**

Score fields:

- exact name/title: high
- capability token match: high
- alias contained in query: high
- query contained in alias: medium
- whenToUse match: medium
- category/behavior filter: hard filter when provided

Return sanitized definitions only. Do not include `execute`.

**Step 4: Run test**

```bash
npm run test -- server/services/agent-tool-catalog.test.ts
```

Expected:

- PASS.

### Task 4: Add Chat Candidate Retrieval Helper

**Files:**

- Modify: `server/services/agent-tool-catalog.ts`
- Test: `server/services/agent-tool-catalog.test.ts`

**Goal:** Provide one function for chat to retrieve common and natural-language matched tools.

**Step 1: Write failing test**

```ts
it('builds chat tool candidates from common tools and message search', () => {
  const candidates = buildChatToolCandidates({
    tools,
    message: '制作一个音乐',
    attachmentKinds: [],
    recentToolNames: [],
    commonToolNames: ['star.speakReply', 'star.generateImage', 'star.generateMusic', 'star.generateVideo'],
    retrievedLimit: 6,
  })

  expect(candidates.commonTools.map(tool => tool.name)).toContain('star.generateMusic')
  expect(candidates.retrievedTools[0].name).toBe('star.generateMusic')
})
```

**Step 2: Run test to verify failure**

```bash
npm run test -- server/services/agent-tool-catalog.test.ts
```

Expected:

- FAIL because helper does not exist.

**Step 3: Implement helper**

Add:

```ts
export function buildChatToolCandidates(input: {
  tools: AgentToolDefinition[]
  message: string
  attachmentKinds: string[]
  recentToolNames: string[]
  commonToolNames: string[]
  retrievedLimit?: number
}) {
  // returns { commonTools, retrievedTools }
}
```

Deduplicate by `name`.

**Step 4: Run test**

```bash
npm run test -- server/services/agent-tool-catalog.test.ts
```

Expected:

- PASS.

---

## Phase 3: Structured Planner Decision

### Task 5: Extend Planner Schema

**Files:**

- Modify: `server/services/star-chat-planner.ts`
- Test: `server/services/star-chat-planner.test.ts`

**Goal:** Require explicit planner decisions.

**Step 1: Write failing tests**

Add tests:

```ts
it('parses tool decisions with basis', () => {
  expect(parseStarChatTurnPlan(JSON.stringify({
    decision: 'tool',
    reply: '可以，我来做音乐。',
    toolCalls: [{
      toolName: 'star.generateMusic',
      input: { prompt: '温柔音乐' },
      mode: 'execute',
      evidence: '用户要求制作音乐。',
      reason: '音乐工具可完成。',
    }],
    toolSearches: [],
    missingInputs: [],
    basis: {
      candidateTools: ['star.generateMusic'],
      selectedTools: ['star.generateMusic'],
      reason: '候选工具支持 generate_music。',
    },
  }))).toMatchObject({
    decision: 'tool',
    toolCalls: [expect.objectContaining({ toolName: 'star.generateMusic' })],
  })
})

it('rejects tool decisions without tool calls', () => {
  expect(parseStarChatTurnPlan(JSON.stringify({
    decision: 'tool',
    reply: '可以。',
    toolCalls: [],
  }))).toEqual(expect.objectContaining({
    decision: 'answer',
    toolCalls: [],
  }))
})
```

**Step 2: Run test to verify failure**

```bash
npm run test -- server/services/star-chat-planner.test.ts
```

Expected:

- FAIL because schema lacks `decision`, `basis`, and decision validation.

**Step 3: Implement schema**

Add:

```ts
const decisionSchema = z.enum([
  'answer',
  'tool',
  'search',
  'clarify',
  'unavailable',
  'refuse',
])
```

Extend `starChatTurnPlanSchema`.

Use `.superRefine()` for structural constraints.

Fallback should be a safe `answer` plan:

```ts
{
  decision: 'answer',
  reply: '',
  toolSearches: [],
  toolCalls: [],
  missingInputs: [],
  basis: { candidateTools: [], selectedTools: [], reason: '' },
}
```

**Step 4: Run test**

```bash
npm run test -- server/services/star-chat-planner.test.ts
```

Expected:

- PASS.

### Task 6: Update Planner Prompt Contract

**Files:**

- Modify: `server/services/star-chat-planner.ts`
- Test: `server/services/star-chat-planner.test.ts`

**Goal:** Tell planner to use tool facts, not model self-limitations.

**Step 1: Write failing test**

```ts
it('instructs planner to treat tool cards as system capabilities', () => {
  const messages = buildStarChatPlannerMessages({
    messages: [{ role: 'user', content: '唱首歌给我听' }],
    commonTools: [musicTool],
    searchedTools: [],
  })

  const system = String(messages[0].content)
  expect(system).toContain('系统能力以工具卡片为准')
  expect(system).toContain('不能因为语言模型自身限制')
  expect(system).toContain('"decision"')
})
```

**Step 2: Run test to verify failure**

```bash
npm run test -- server/services/star-chat-planner.test.ts
```

Expected:

- FAIL until prompt is updated.

**Step 3: Update planner system message**

Include:

- decision schema
- tool facts rule
- no tool invention
- common tool priority
- clarify only when required input cannot be inferred
- unavailable only when no candidate tool can satisfy

**Step 4: Run test**

```bash
npm run test -- server/services/star-chat-planner.test.ts
```

Expected:

- PASS.

---

## Phase 4: Chat Planning Flow

### Task 7: Wire Candidate Retrieval Into Chat Planner

**Files:**

- Modify: `server/services/star-chat.ts`
- Modify: `server/services/star-chat-planner.ts`
- Test: `server/api/chat.post.test.ts`
- Test: `server/services/star-chat-planner.test.ts`

**Goal:** Plan chat turns from common and retrieved tools, not only planner-requested search.

**Step 1: Write failing tests**

Add API helper test:

```ts
it('plans music generation from natural language when candidate tool is available', async () => {
  const provider = {
    chat: vi.fn(async () => ({
      reply: JSON.stringify({
        decision: 'tool',
        reply: '可以，我来做音乐。',
        toolSearches: [],
        toolCalls: [{
          toolName: 'star.generateMusic',
          input: { prompt: '温柔音乐' },
          mode: 'execute',
          evidence: '用户要求制作音乐。',
          reason: '音乐工具可完成。',
        }],
        missingInputs: [],
        basis: {
          candidateTools: ['star.generateMusic'],
          selectedTools: ['star.generateMusic'],
          reason: '候选工具支持音乐生成。',
        },
      }),
    })),
  }

  const result = await planStarChatTools({
    prompt: '制作一个音乐',
    attachmentKinds: [],
    baseMessages: [{ role: 'user', content: '制作一个音乐' }],
    provider: provider as never,
    registry,
    commonToolNames,
  })

  expect(provider.chat).toHaveBeenCalledTimes(1)
  expect(result.plan.toolCalls[0].toolName).toBe('star.generateMusic')
})
```

**Step 2: Run test to verify failure**

```bash
npm run test -- server/api/chat.post.test.ts server/services/star-chat-planner.test.ts
```

Expected:

- FAIL because current planner does not use retrieval helper and may still use older function name.

**Step 3: Implement planning flow**

Rename if useful:

```ts
planStarChatToolsForIntent -> planStarChatTools
```

Input should include:

```ts
attachmentKinds: AttachmentKind[]
recentToolNames?: string[]
```

Inside:

```ts
const candidates = buildChatToolCandidates({
  tools: registry.list(),
  message: prompt,
  attachmentKinds,
  recentToolNames: [],
  commonToolNames,
})
```

Pass `commonTools` and `retrievedTools` to planner.

**Step 4: Run tests**

```bash
npm run test -- server/api/chat.post.test.ts server/services/star-chat-planner.test.ts
```

Expected:

- PASS.

### Task 8: Support One Additional Planner Search

**Files:**

- Modify: `server/services/star-chat-planner.ts`
- Test: `server/services/star-chat-planner.test.ts`

**Goal:** Allow planner to ask for one extra search when initial candidates are insufficient.

**Step 1: Write failing test**

```ts
it('runs one additional search and does not allow recursive search', async () => {
  const provider = {
    chat: vi.fn()
      .mockResolvedValueOnce({ reply: JSON.stringify({
        decision: 'search',
        reply: '',
        toolSearches: [{ query: '睡眠整理', category: 'system', behavior: 'mutate' }],
        toolCalls: [],
        missingInputs: [],
        basis: { candidateTools: [], selectedTools: [], reason: '需要找系统整理工具。' },
      }) })
      .mockResolvedValueOnce({ reply: JSON.stringify({
        decision: 'tool',
        reply: '可以整理。',
        toolSearches: [{ query: '再次搜索' }],
        toolCalls: [{ toolName: 'star.sleep', input: {}, mode: 'execute', evidence: '', reason: '' }],
        missingInputs: [],
        basis: { candidateTools: ['star.sleep'], selectedTools: ['star.sleep'], reason: '找到睡眠整理工具。' },
      }) }),
  }

  const plan = await planStarChatTurn({ ...input, provider })

  expect(provider.chat).toHaveBeenCalledTimes(2)
  expect(plan.decision).toBe('tool')
  expect(plan.toolSearches).toEqual([])
})
```

**Step 2: Run test to verify failure**

```bash
npm run test -- server/services/star-chat-planner.test.ts
```

Expected:

- FAIL if recursive search is not constrained.

**Step 3: Implement second pass**

Rules:

- First pass may output `decision: search`.
- Search at most 2 queries.
- Second pass receives added searched tools.
- If second pass returns `decision: search`, convert to safe `answer` or `clarify`.

**Step 4: Run test**

```bash
npm run test -- server/services/star-chat-planner.test.ts
```

Expected:

- PASS.

---

## Phase 5: Plan Validation And Execution

### Task 9: Add Plan Validator

**Files:**

- Create or Modify: `server/services/star-chat-planner.ts`
- Test: `server/services/star-chat-planner.test.ts`

**Goal:** Keep backend validation structural, not semantic.

**Step 1: Write failing tests**

```ts
it('rejects unknown selected tools', () => {
  const result = validateStarChatPlan({
    plan: toolPlanWithUnknownTool,
    registry,
  })

  expect(result.valid).toBe(false)
  expect(result.reason).toContain('Unknown tool')
})

it('accepts unavailable decisions without tool calls', () => {
  const result = validateStarChatPlan({
    plan: unavailablePlan,
    registry,
  })

  expect(result.valid).toBe(true)
})
```

**Step 2: Run test to verify failure**

```bash
npm run test -- server/services/star-chat-planner.test.ts
```

Expected:

- FAIL because validator does not exist.

**Step 3: Implement validator**

Check:

- `decision: tool` requires tool calls.
- `decision: search` requires tool searches.
- `decision: clarify` requires missing inputs.
- all selected tools exist.
- no unknown tool call.

Do not inspect Chinese denial phrases.

**Step 4: Run test**

```bash
npm run test -- server/services/star-chat-planner.test.ts
```

Expected:

- PASS.

### Task 10: Wire Decision Handling In Chat Route

**Files:**

- Modify: `server/api/chat/stream.post.ts`
- Modify: `server/services/star-chat.ts`
- Test: `server/api/chat.post.test.ts`

**Goal:** Route planner decisions to text reply, clarification, unavailable reply, refusal, or tool execution.

**Step 1: Write failing tests**

Add helper-level tests for:

- `decision: answer` falls back to text reply or planner reply.
- `decision: clarify` returns planner reply and no tools.
- `decision: unavailable` returns planner reply and no tools.
- `decision: tool` executes calls.
- invalid plan records fallback behavior.

**Step 2: Run test to verify failure**

```bash
npm run test -- server/api/chat.post.test.ts
```

Expected:

- FAIL because route does not branch by `decision`.

**Step 3: Implement decision handling**

Rules:

```ts
if (plan.decision === 'answer' && plan.reply) {
  emit text message
}

if (plan.decision === 'clarify' || plan.decision === 'unavailable' || plan.decision === 'refuse') {
  emit planner reply as assistant message
}

if (plan.decision === 'tool') {
  emit reply delta
  normalize and execute tool calls
}
```

If `validateStarChatPlan()` fails:

- record event if available.
- fallback to `streamStarChatTextReply()`.

**Step 4: Run test**

```bash
npm run test -- server/api/chat.post.test.ts
```

Expected:

- PASS.

### Task 11: Preserve Existing Tool Execution Semantics

**Files:**

- Modify: `server/services/star-chat-tool-execution.ts`
- Test: `server/services/star-chat-tool-execution.test.ts`

**Goal:** Ensure new planner fields do not break current execution behavior.

**Step 1: Add regression tests**

Test:

- `star.speakReply` still replaces `$reply`.
- media tools still require prompt.
- `propose` still only queues approval.
- raw base64 still stays out of task result.

**Step 2: Run test**

```bash
npm run test -- server/services/star-chat-tool-execution.test.ts
```

Expected:

- PASS before or after minimal changes.

**Step 3: Implement only if failing**

Do not refactor execution unless tests prove it is needed.

---

## Phase 6: End-To-End Natural Language Coverage

### Task 12: Add Planner Natural Language Tests

**Files:**

- Modify: `server/services/star-chat-planner.test.ts`
- Modify: `server/api/chat.post.test.ts`

**Goal:** Cover the natural language cases that replaced old user-selected modes.

**Tests:**

- “唱首歌给我听” selects `star.generateMusic`.
- “制作一个音乐” selects `star.generateMusic`.
- “读给我听” selects `star.speakReply`.
- “生成一张图片” selects `star.generateImage`.
- “做个视频” selects `star.generateVideo`.
- “做一个” produces `decision: clarify`.

Use mocked provider replies for planner contract tests.

Use catalog retrieval tests to verify candidate ordering.

**Run:**

```bash
npm run test -- server/services/agent-tool-catalog.test.ts server/services/star-chat-planner.test.ts server/api/chat.post.test.ts
```

Expected:

- PASS.

### Task 13: Update E2E Main Flow

**Files:**

- Modify: `tests/e2e/main-flow.spec.ts`

**Goal:** Verify UI still uses natural language and never sends `intent`.

**Step 1: Update route mock assertions**

In the chat stream route mock:

```ts
expect(body.intent).toBeUndefined()
```

Mock natural language generation:

- message `生成一张月光星空图片` returns image part.
- message `制作一个音乐` returns music part.

**Step 2: Run E2E**

```bash
npm run test:e2e -- tests/e2e/main-flow.spec.ts
```

Expected:

- PASS in desktop and mobile projects.

---

## Phase 7: Documentation And Cleanup

### Task 14: Update Capability Docs

**Files:**

- Modify: `docs/plans/2026-05-19-star-chat-tool-capability-design.md`
- Modify: `docs/plans/2026-05-19-star-chat-tool-capability-implementation.md`
- Keep: `docs/plans/2026-05-19-natural-language-tool-planning-design.md`
- Keep: `docs/plans/2026-05-19-natural-language-tool-planning-implementation.md`

**Goal:** Make the old capability docs point to the natural language planner design.

**Step 1: Add note**

Add near the top:

```md
后续自然语言工具规划以
`2026-05-19-natural-language-tool-planning-design.md`
和
`2026-05-19-natural-language-tool-planning-implementation.md`
为准。
```

**Step 2: Scan old references**

Run:

```bash
rg -n "intent|chat-intent|streamStarChatReply|useMediaTasks|/api/(image|music|tts|video/tasks)" docs/plans/2026-05-19-*.md server components composables tests
```

Expected:

- Production code has no old routing references.
- Docs may mention removed old paths only as historical context.

### Task 15: Final Verification

**Files:**

- No code changes unless verification reveals a bug.

**Run focused tests:**

```bash
npm run test -- server/services/agent-runtime.test.ts server/services/agent-tool-catalog.test.ts server/services/star-agent-tools.test.ts server/services/star-chat-planner.test.ts server/services/star-chat-tool-execution.test.ts server/api/chat.post.test.ts components/StarChat.test.ts components/StarChatMessage.test.ts components/StarComposer.test.ts
```

Expected:

- PASS.

**Run full unit tests:**

```bash
npm run test
```

Expected:

- PASS.

**Run build:**

```bash
npm run build
```

Expected:

- PASS.

**Run E2E:**

```bash
npm run test:e2e -- tests/e2e/main-flow.spec.ts
```

Expected:

- PASS.

**Final scan:**

```bash
rg -n "buildForcedToolCallFromIntent|forcedToolByIntent|defaultReplyForIntent|streamStarChatReply|resolveChatIntent|chat-intent|useMediaTasks|/api/(image|music|tts|video/tasks)|StarChatIntent|selectedMediaKinds|toggleMediaKind" server components composables pages tests
```

Expected:

- No matches.

## Acceptance Criteria

- Natural language requests select tools without user mode selection.
- “唱首歌给我听” and “制作一个音乐” use `star.generateMusic`.
- “读给我听” uses `star.speakReply`.
- Planner output always includes `decision`.
- Backend validates structure only.
- No refusal-correction layer exists.
- No old `intent` route exists.
- Media results still return through `chatParts`.
- Task result still excludes raw base64.
- All focused tests, full tests, build, and E2E pass.
