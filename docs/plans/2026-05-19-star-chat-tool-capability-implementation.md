# Star Chat Tool Capability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

> 后续自然语言工具规划以 `2026-05-19-natural-language-tool-planning-design.md` 和 `2026-05-19-natural-language-tool-planning-implementation.md` 为准。本文只保留早期实施背景，其中关于旧 `intent` 兼容的内容不再作为后续实现依据。

**Goal:** Replace keyword-based chat media routing with a capability-aware chat planner that uses common tools, tool search, policy gates, and existing Agent OS task approvals.

**Historical Architecture:** This document originally planned a staged migration from `intent` compatibility to tool planning. Current implementation follows the natural language planner documents above: chat requests carry `message` and `attachments`, and tool execution flows through catalog retrieval, planner decisions, policy, task queue, and executor.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript, Nitro server routes, better-sqlite3, Zod, Vitest, Vue Test Utils, Playwright, MiniMax chat/stream/media clients.

---

## Execution Rules

- Start from the current dirty tree carefully.
- Do not revert unrelated changes.
- Use TDD for service behavior.
- Do not restore `intent` compatibility in `/api/chat/stream`.
- Do not expose raw provider payloads or raw base64 in task results.
- Reuse `agent-policy.ts`, `agent-task-queue.ts`, `agent-os.ts`, and `AgentToolRegistry`.
- Do not create a second approval system.
- Run focused tests after each service change.
- Run `npm run check` before final handoff.

## Baseline Check

Run:

```bash
npm run test -- server/api/chat.post.test.ts server/services/star-agent-tools.test.ts server/services/agent-policy.test.ts
npm run build
```

Expected:

- Dirty files are known and not overwritten.
- Existing focused tests pass, or existing failures are documented before this work starts.
- Build passes, or existing build failure is documented before this work starts.

---

## Phase 1: Tool Metadata And Catalog Search

### Task 1: Extend Tool Definitions

**Files:**

- Modify: `server/services/agent-runtime.ts`
- Test: `server/services/agent-runtime.test.ts`

**Goal:** Add searchable metadata to `AgentToolDefinition` without breaking existing tool registration.

**Step 1: Write failing tests**

Add tests for:

- `registry.list()` includes metadata when provided.
- Existing tools without metadata still list safely.
- `registry.get(name)` still returns executable tool.

Expected shape:

```ts
expect(registry.list()[0]).toMatchObject({
  name: 'star.generateImage',
  title: '生成图片',
  category: 'media',
  behavior: 'create',
})
```

**Step 2: Run test to verify failure**

```bash
npm run test -- server/services/agent-runtime.test.ts
```

Expected:

- FAIL because metadata fields do not exist yet.

**Step 3: Implement minimal type extension**

Add:

```ts
export type AgentToolCategory =
  | 'reply'
  | 'media'
  | 'memory'
  | 'design'
  | 'publish'
  | 'system'

export type AgentToolBehavior =
  | 'present_reply'
  | 'create'
  | 'retrieve'
  | 'mutate'
  | 'publish'

export type AgentToolMetadata = {
  title?: string
  category?: AgentToolCategory
  behavior?: AgentToolBehavior
  aliases?: string[]
  whenToUse?: string
  inputSchema?: Record<string, unknown>
}
```

Extend `AgentTool` and `AgentToolDefinition` with this metadata.

Keep fields optional for compatibility.

**Step 4: Run test**

```bash
npm run test -- server/services/agent-runtime.test.ts
```

Expected:

- PASS.

**Step 5: Commit**

```bash
git add server/services/agent-runtime.ts server/services/agent-runtime.test.ts
git commit -m "feat: add agent tool metadata"
```

### Task 2: Add Tool Catalog Search

**Files:**

- Create: `server/services/agent-tool-catalog.ts`
- Test: `server/services/agent-tool-catalog.test.ts`

**Goal:** Provide deterministic local search over tool metadata.

**Step 1: Write failing tests**

Cover:

- Search by alias returns matching tool.
- Category filter limits results.
- Behavior filter limits results.
- Limit defaults to 5.
- Results do not include executable functions.

Example:

```ts
expect(searchAgentTools({
  tools,
  query: '画一张',
})[0]?.name).toBe('star.generateImage')
```

**Step 2: Run test to verify failure**

```bash
npm run test -- server/services/agent-tool-catalog.test.ts
```

Expected:

- FAIL because service does not exist.

**Step 3: Implement search**

Implement:

```ts
export function searchAgentTools(input: {
  tools: AgentToolDefinition[]
  query: string
  category?: AgentToolCategory
  behavior?: AgentToolBehavior
  limit?: number
}): AgentToolDefinition[]
```

Scoring:

- Exact name/title match: high score.
- Alias match: high score.
- Description and whenToUse match: medium score.
- Category and behavior filter: hard filter.
- Stable tie-breaker by `name`.

**Step 4: Run test**

```bash
npm run test -- server/services/agent-tool-catalog.test.ts
```

Expected:

- PASS.

**Step 5: Commit**

```bash
git add server/services/agent-tool-catalog.ts server/services/agent-tool-catalog.test.ts
git commit -m "feat: add agent tool catalog search"
```

### Task 3: Add Metadata To Star Tools

**Files:**

- Modify: `server/services/star-agent-tools.ts`
- Test: `server/services/star-agent-tools.test.ts`

**Goal:** Register existing star tools with short metadata cards.

**Step 1: Write failing tests**

Assert metadata exists for:

- `star.generateImage`
- `star.generateMusic`
- `star.generateVideo`
- `star.governMemory`
- `star.publishWork`
- `star.previewDesign`
- `star.commitDesign`

**Step 2: Run test**

```bash
npm run test -- server/services/star-agent-tools.test.ts
```

Expected:

- FAIL because metadata is missing.

**Step 3: Add metadata**

Example:

```ts
registry.register({
  name: 'star.generateImage',
  title: '生成图片',
  description: 'Generate an image artifact.',
  category: 'media',
  behavior: 'create',
  aliases: ['画一张', '图片', '插画', '海报'],
  whenToUse: '用户明确要求生成静态画面，或确认了图片生成建议。',
  inputSchema: { prompt: 'string' },
  riskLevel: 'medium',
  approvalRequired: false,
  execute: ...
})
```

**Step 4: Run test**

```bash
npm run test -- server/services/star-agent-tools.test.ts
```

Expected:

- PASS.

**Step 5: Commit**

```bash
git add server/services/star-agent-tools.ts server/services/star-agent-tools.test.ts
git commit -m "feat: describe star agent tools"
```

---

## Phase 2: Reply Presentation And Retrieval Tools

### Task 4: Add `star.speakReply`

**Files:**

- Modify: `server/services/star-agent-tools.ts`
- Modify: `server/services/star-agent-runtime.ts`
- Test: `server/services/star-agent-tools.test.ts`

**Goal:** Represent voice reply as a reply presentation tool, not a media intent.

**Step 1: Write failing test**

Test that:

- `star.speakReply` is registered.
- It calls injected text-to-speech stream or generator.
- It returns a sanitized audio reference or base64 only where chat storage can immediately move it to attachment storage.

**Step 2: Run test**

```bash
npm run test -- server/services/star-agent-tools.test.ts
```

Expected:

- FAIL because tool does not exist.

**Step 3: Implement tool**

Add context field:

```ts
reply?: {
  speak?: (text: string) => Promise<{ url?: string, base64?: string }>
}
```

Register:

```ts
star.speakReply
```

Metadata:

- category: `reply`
- behavior: `present_reply`
- aliases: `['读给我听', '语音回复', '念给我听']`
- inputSchema: `{ text: 'string' }`

**Step 4: Run test**

```bash
npm run test -- server/services/star-agent-tools.test.ts
```

Expected:

- PASS.

**Step 5: Commit**

```bash
git add server/services/star-agent-tools.ts server/services/star-agent-runtime.ts server/services/star-agent-tools.test.ts
git commit -m "feat: add speak reply tool"
```

### Task 5: Add Low-Risk Retrieval Tools

**Files:**

- Modify: `server/services/star-agent-tools.ts`
- Test: `server/services/star-agent-tools.test.ts`

**Goal:** Let the planner retrieve ids before proposing memory or work actions.

**Step 1: Write failing tests**

Add tests for:

- `star.searchMemories` returns sanitized memory summaries and ids.
- `star.searchWorks` returns sanitized work summaries and ids.
- Neither returns raw payload JSON, raw media data, key id, or private blobs.

**Step 2: Run test**

```bash
npm run test -- server/services/star-agent-tools.test.ts
```

Expected:

- FAIL because retrieval tools do not exist.

**Step 3: Implement tools**

Add optional context:

```ts
memorySearch?: {
  search: (keyId: string, query: string, limit: number) => Array<{ id: string, content: string, status?: string }>
}
workSearch?: {
  search: (keyId: string, query: string, limit: number) => Array<{ id: string, type: string, title: string, summary: string }>
}
```

Register:

- `star.searchMemories`
- `star.searchWorks`

Risk:

- `low`

Approval:

- `false`

**Step 4: Run test**

```bash
npm run test -- server/services/star-agent-tools.test.ts
```

Expected:

- PASS.

**Step 5: Commit**

```bash
git add server/services/star-agent-tools.ts server/services/star-agent-tools.test.ts
git commit -m "feat: add star retrieval tools"
```

---

## Phase 3: Chat Planner

### Task 6: Add Turn Plan Schema And Parser

**Files:**

- Create: `server/services/star-chat-planner.ts`
- Test: `server/services/star-chat-planner.test.ts`

**Goal:** Parse and validate planner JSON safely.

**Step 1: Write failing tests**

Cover:

- Valid plan parses.
- Markdown-wrapped JSON parses.
- Invalid JSON returns fallback plan.
- Unknown mode is rejected.
- Tool call input must be object.

**Step 2: Run test**

```bash
npm run test -- server/services/star-chat-planner.test.ts
```

Expected:

- FAIL because service does not exist.

**Step 3: Implement parser**

Use Zod.

Types:

```ts
export const starChatTurnPlanSchema = z.object({
  reply: z.string().trim().default(''),
  toolSearches: z.array(...).max(2).default([]),
  toolCalls: z.array(...).max(4).default([]),
})
```

Export:

```ts
parseStarChatTurnPlan(text: string): StarChatTurnPlan
```

Fallback:

```ts
{ reply: '', toolSearches: [], toolCalls: [] }
```

**Step 4: Run test**

```bash
npm run test -- server/services/star-chat-planner.test.ts
```

Expected:

- PASS.

**Step 5: Commit**

```bash
git add server/services/star-chat-planner.ts server/services/star-chat-planner.test.ts
git commit -m "feat: parse star chat turn plans"
```

### Task 7: Build Planner Messages

**Files:**

- Modify: `server/services/star-chat-planner.ts`
- Test: `server/services/star-chat-planner.test.ts`

**Goal:** Build compact model input with common tools and `tool.search`.

**Step 1: Write failing tests**

Assert:

- Only configured common tools are included.
- Tool cards are compact.
- `tool.search` instructions are included once.
- Private data is not included in tool cards.

**Step 2: Run test**

```bash
npm run test -- server/services/star-chat-planner.test.ts
```

Expected:

- FAIL.

**Step 3: Implement message builder**

Export:

```ts
buildStarChatPlannerMessages(input: {
  messages: MiniMaxMessage[]
  commonTools: AgentToolDefinition[]
  searchedTools?: AgentToolDefinition[]
}): MiniMaxMessage[]
```

System instructions:

- Return JSON only.
- Use common tools when enough.
- Use `tool.search` only when current list is insufficient.
- Do not invent tools.
- Use `mode: propose` for implicit actions.
- High-risk actions may be overridden by backend policy.

**Step 4: Run test**

```bash
npm run test -- server/services/star-chat-planner.test.ts
```

Expected:

- PASS.

**Step 5: Commit**

```bash
git add server/services/star-chat-planner.ts server/services/star-chat-planner.test.ts
git commit -m "feat: build star chat planner context"
```

### Task 8: Add Planner Loop With Tool Search

**Files:**

- Modify: `server/services/star-chat-planner.ts`
- Test: `server/services/star-chat-planner.test.ts`

**Goal:** Let the model search tools up to a strict limit, then return a final plan.

**Step 1: Write failing tests**

Use fake model provider.

Test:

- First model response requests tool search.
- Search returns matching tool.
- Second model response uses searched tool.
- More than 2 searches are ignored.
- Unknown searched category is ignored.

**Step 2: Run test**

```bash
npm run test -- server/services/star-chat-planner.test.ts
```

Expected:

- FAIL.

**Step 3: Implement loop**

Export:

```ts
planStarChatTurn(input: {
  provider: Pick<NamedAgentModelProvider, 'chat'>
  baseMessages: MiniMaxMessage[]
  registry: Pick<AgentToolRegistry, 'list'>
  commonToolNames: string[]
}): Promise<StarChatTurnPlan>
```

Algorithm:

1. Get common tool cards.
2. Ask provider for plan.
3. If plan has searches, run local `searchAgentTools`.
4. Ask provider again with search results.
5. Return final plan.

**Step 4: Run test**

```bash
npm run test -- server/services/star-chat-planner.test.ts
```

Expected:

- PASS.

**Step 5: Commit**

```bash
git add server/services/star-chat-planner.ts server/services/star-chat-planner.test.ts
git commit -m "feat: plan chat turns with tool search"
```

---

## Phase 4: Chat Tool Execution Adapter

### Task 9: Add Tool Call Validation

**Files:**

- Create: `server/services/star-chat-tool-execution.ts`
- Test: `server/services/star-chat-tool-execution.test.ts`

**Goal:** Validate planner tool calls before policy or execution.

**Step 1: Write failing tests**

Cover:

- Unknown tool is rejected.
- Missing required `prompt` is rejected for media tools.
- `star.speakReply` replaces `$reply` with final reply text.
- Tool call count is capped.

**Step 2: Run test**

```bash
npm run test -- server/services/star-chat-tool-execution.test.ts
```

Expected:

- FAIL.

**Step 3: Implement validator**

Export:

```ts
normalizeStarChatToolCalls(input: {
  plan: StarChatTurnPlan
  registry: Pick<AgentToolRegistry, 'get'>
  reply: string
}): NormalizedStarChatToolCall[]
```

Keep validation minimal and explicit for first supported tools.

**Step 4: Run test**

```bash
npm run test -- server/services/star-chat-tool-execution.test.ts
```

Expected:

- PASS.

**Step 5: Commit**

```bash
git add server/services/star-chat-tool-execution.ts server/services/star-chat-tool-execution.test.ts
git commit -m "feat: validate star chat tool calls"
```

### Task 10: Route Tool Calls Through Task Queue

**Files:**

- Modify: `server/services/star-chat-tool-execution.ts`
- Test: `server/services/star-chat-tool-execution.test.ts`

**Goal:** Reuse existing task queue and policy gate for chat-triggered tools.

**Step 1: Write failing tests**

Test:

- `mode: propose` creates a `waiting_approval` task.
- Explicit low-risk retrieval can run immediately.
- High-risk tool becomes `waiting_approval` even if mode is `execute`.
- Policy denial returns a safe status.

**Step 2: Run test**

```bash
npm run test -- server/services/star-chat-tool-execution.test.ts
```

Expected:

- FAIL.

**Step 3: Implement adapter**

Export:

```ts
executeStarChatToolCalls(input: {
  agentId: string
  now: string
  calls: NormalizedStarChatToolCall[]
  tasks: Required<Pick<TaskRepository, 'addTask' | 'updateTask'>>
  events: EventRepository
  registry: Pick<AgentToolRegistry, 'get' | 'execute'>
  policy: AgentPolicy
}): Promise<StarChatToolExecutionResult[]>
```

Use:

- `enqueueAgentTask`
- `createAgentLoop().runTask`

For proposed calls:

- Enqueue task.
- Run task without approval.
- Expect `waiting_approval` when policy requires approval.

**Step 4: Run test**

```bash
npm run test -- server/services/star-chat-tool-execution.test.ts
```

Expected:

- PASS.

**Step 5: Commit**

```bash
git add server/services/star-chat-tool-execution.ts server/services/star-chat-tool-execution.test.ts
git commit -m "feat: execute chat tools through agent tasks"
```

---

## Phase 5: Chat Stream Integration

### Task 11: Extend Chat Stream Event Types

**Files:**

- Modify: `server/services/star-chat.ts`
- Modify: `composables/useStarChat.ts`
- Test: `server/api/chat.post.test.ts`

**Goal:** Add tool status and confirmation events without breaking existing stream events.

**Step 1: Write failing tests**

Assert events can include:

```ts
{ type: 'tool-status', text: '...' }
{ type: 'tool-confirmation', taskId: 'task_1', inboxItemId: 'task_approval:task_1', title: '...', summary: '...' }
```

**Step 2: Run test**

```bash
npm run test -- server/api/chat.post.test.ts
```

Expected:

- FAIL.

**Step 3: Extend types**

Add stream event variants in:

- `server/services/star-chat.ts`
- `composables/useStarChat.ts`

Do not remove old variants.

**Step 4: Run test**

```bash
npm run test -- server/api/chat.post.test.ts
```

Expected:

- PASS.

**Step 5: Commit**

```bash
git add server/services/star-chat.ts composables/useStarChat.ts server/api/chat.post.test.ts
git commit -m "feat: stream chat tool events"
```

### Task 12: Remove Compatibility Intent Routing

**Files:**

- Modify: `server/services/star-chat.ts`
- Modify: `server/api/chat/stream.post.ts`
- Test: `server/api/chat.post.test.ts`

**Goal:** Remove the old request shape and force all media decisions through planner and tool execution.

**Step 1: Write failing tests**

Test:

- `intent` is stripped from chat request parsing.
- `imageDataUrl` is stripped from chat request parsing.
- Planner is called for chat tool decisions.
- Planner failure falls back to normal chat.

**Step 2: Run test**

```bash
npm run test -- server/api/chat.post.test.ts
```

Expected:

- FAIL.

**Step 3: Delete compatibility mapping**

Remove `buildForcedToolCallFromIntent()`, `chat-intent.ts`, and the media branches in `streamStarChatReply()`.

**Step 4: Wire planner into route**

In `server/api/chat/stream.post.ts`:

- Create tool registry.
- Register star tools with chat context.
- Build common tool list.
- Call planner.
- Execute validated tool calls.
- Emit tool statuses and confirmations.

Keep conversation storage behavior intact.

**Step 5: Run tests**

```bash
npm run test -- server/api/chat.post.test.ts server/services/star-chat-planner.test.ts server/services/star-chat-tool-execution.test.ts
```

Expected:

- PASS.

**Step 6: Commit**

```bash
git add server/services/star-chat.ts server/api/chat/stream.post.ts server/api/chat.post.test.ts
git commit -m "feat: plan chat turns with tools"
```

---

## Phase 6: Frontend Confirmation Cards

### Task 13: Render Tool Confirmation Parts

**Files:**

- Modify: `composables/useStarChat.ts`
- Modify: `components/StarChat.vue`
- Modify: `components/StarChatMessage.vue` if message rendering lives there
- Test: `components/StarChat.test.ts`
- Test: `components/StarChatMessage.test.ts`

**Goal:** Show chat-native approve/reject controls for waiting tool tasks.

**Step 1: Write failing component tests**

Test:

- `tool-confirmation` event adds a visible confirmation card.
- Approve button calls the inbox approve endpoint.
- Reject button calls the inbox reject endpoint.
- Confirmation card includes title and summary.

**Step 2: Run test**

```bash
npm run test -- components/StarChat.test.ts components/StarChatMessage.test.ts
```

Expected:

- FAIL.

**Step 3: Implement UI**

Add part:

```ts
{ type: 'tool_confirmation', taskId: string, inboxItemId: string, title: string, summary: string }
```

Add methods:

```ts
approveInboxItem(inboxItemId: string)
rejectInboxItem(inboxItemId: string)
```

Use existing CSRF helper.

**Step 4: Run tests**

```bash
npm run test -- components/StarChat.test.ts components/StarChatMessage.test.ts
```

Expected:

- PASS.

**Step 5: Commit**

```bash
git add composables/useStarChat.ts components/StarChat.vue components/StarChatMessage.vue components/StarChat.test.ts components/StarChatMessage.test.ts
git commit -m "feat: confirm chat tool actions inline"
```

### Task 14: Reframe Composer Media Buttons

**Files:**

- Modify: `components/StarComposer.vue`
- Modify: `components/StarComposer.test.ts`
- Modify: `components/StarChat.vue`

**Goal:** Remove shortcut state from chat requests. Users express media needs in natural language or attachments.

**Step 1: Write failing tests**

Test:

- Composer does not render media intent buttons.
- Submitting a chat request sends no `intent`.
- User image preview uses message `parts`, not `imageDataUrl`.

**Step 2: Run test**

```bash
npm run test -- components/StarComposer.test.ts components/StarChat.test.ts
```

Expected:

- FAIL if current wording or behavior still exposes mode as primary.

**Step 3: Adjust UI**

Keep icon buttons.

Labels should read as actions:

- `生成语音`
- `生成图片`
- `生成视频`
- `生成音乐`

Do not add long explanatory text in the app.

**Step 4: Run tests**

```bash
npm run test -- components/StarComposer.test.ts components/StarChat.test.ts
```

Expected:

- PASS.

**Step 5: Commit**

```bash
git add components/StarComposer.vue components/StarComposer.test.ts components/StarChat.vue components/StarChat.test.ts
git commit -m "refactor: make composer media buttons shortcuts"
```

---

## Phase 7: End-To-End And Cleanup

### Task 15: Add E2E Coverage

**Files:**

- Modify: `tests/e2e/main-flow.spec.ts`

**Goal:** Verify the user-facing flow.

**Step 1: Add tests**

Cover:

- Plain message returns normal chat.
- Explicit image request returns generated work/status.
- Implicit image suggestion shows confirmation card and does not generate immediately.
- Approving confirmation calls inbox approve.

**Step 2: Run E2E**

```bash
npm run test:e2e -- tests/e2e/main-flow.spec.ts
```

Expected:

- PASS.

**Step 3: Commit**

```bash
git add tests/e2e/main-flow.spec.ts
git commit -m "test: cover chat tool confirmation flow"
```

### Task 16: Delete Keyword Intent Compatibility

**Files:**

- Delete: `server/services/chat-intent.ts`
- Delete: `server/services/chat-intent.test.ts`

**Goal:** Remove the resolver entirely.

**Step 1: Adjust tests**

Assert there is no production reference to `chat-intent`.

**Step 2: Run tests**

```bash
npm run test -- server/api/chat.post.test.ts
```

Expected:

- PASS.

**Step 3: Commit**

```bash
git add server/services/chat-intent.ts server/services/chat-intent.test.ts server/api/chat.post.test.ts
git commit -m "refactor: remove chat intent compatibility"
```

### Task 17: Full Verification

**Files:**

- No source edits expected.

**Run:**

```bash
npm run test
npm run build
npm run test:e2e
```

Expected:

- All tests pass.
- Build passes.
- E2E passes.

If E2E is too slow for the branch handoff, run focused E2E and document why full E2E was skipped.

### Task 18: Final Review

**Files:**

- Review all modified files.

**Checks:**

```bash
git diff --stat
rg "Agent Core|Agent OS|tool.search" components pages server
rg "data:image|data:audio" server/services server/api
```

Expected:

- `tool.search` appears only in planner/tool catalog code and tests.
- Raw media payloads are not exposed through task results.
- No unrelated files were reverted.

Then run `/code-review-expert`.

If sensitive data, memory, publishing, or user input handling changed, run `/security-review` before `/gencom`.
