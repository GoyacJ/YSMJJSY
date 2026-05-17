# Key Agent Memory Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add one evolving AI agent per key, with structured memories, reflections, confirmable evolution proposals, and a visible agent core panel.

**Architecture:** Extend the current Nuxt/Nitro SQLite architecture. Keep chat generation as the primary path, then run learning as a secondary step after the assistant reply is saved. Store reflections and evolution proposals by `key_id`, and apply proposals only after explicit user confirmation.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Nitro server routes, better-sqlite3, Zod, MiniMax service client, Vitest, Playwright.

---

### Task 1: Extend Agent Data Schema

**Files:**
- Modify: `server/db/schema.ts`
- Modify: `server/db/sqlite.ts`
- Test: `server/db/sqlite.test.ts`

**Step 1: Write failing repository tests**

Add tests that verify:

- `agent_reflections` can be inserted and listed by `keyId`.
- `agent_evolution_proposals` can be inserted, listed, and updated.
- `agent_state_snapshots` can be inserted and listed by `keyId`.
- new memory fields can be written and read.

**Step 2: Run the failing tests**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected: FAIL because repositories and columns do not exist.

**Step 3: Add schema statements**

Add:

- `agent_reflections`
- `agent_evolution_proposals`
- `agent_state_snapshots`

Also extend `memories` with:

- `confidence REAL NOT NULL DEFAULT 1`
- `source_conversation_id TEXT`
- `source_attachment_id TEXT`
- `status TEXT NOT NULL DEFAULT 'active'`
- `updated_at TEXT`

Use `ensureColumn` for migrations.

**Step 4: Add repository methods**

Add types and repositories in `server/db/sqlite.ts`:

- `AgentReflectionRecord`
- `AgentEvolutionProposalRecord`
- `AgentStateSnapshotRecord`
- `createAgentReflectionRepository`
- `createAgentEvolutionRepository`
- `createAgentSnapshotRepository`

**Step 5: Run tests**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected: PASS.

---

### Task 2: Normalize Agent Memory Rules

**Files:**
- Modify: `server/services/memory.ts`
- Test: `server/services/memory.test.ts`

**Step 1: Write failing tests**

Cover:

- allowed memory types include `event`, `person`, and `creative_asset`.
- low confidence memories are rejected.
- rejected inference patterns are still blocked.
- normalized memory status defaults to `active`.

**Step 2: Run failing tests**

Run:

```bash
npm run test -- server/services/memory.test.ts
```

Expected: FAIL.

**Step 3: Update memory service**

Add:

```ts
export type AgentMemoryType =
  | 'emotion'
  | 'preference'
  | 'event'
  | 'person'
  | 'creative_asset'
```

Update persistence rules:

- `importance >= 0.5`
- `confidence >= 0.65`
- content is non-empty
- type is allowed
- inference patterns are rejected

**Step 4: Run tests**

Run:

```bash
npm run test -- server/services/memory.test.ts
```

Expected: PASS.

---

### Task 3: Build Agent Reflection Service

**Files:**
- Create: `server/services/agent-learning.ts`
- Test: `server/services/agent-learning.test.ts`

**Step 1: Write failing tests**

Test pure functions first:

- `buildAgentReflectionMessages` includes the user message, assistant reply, existing memories, and current profile.
- `parseAgentReflectionResult` accepts valid JSON.
- invalid proposal types are discarded.
- invalid memory types are discarded.

**Step 2: Run failing tests**

Run:

```bash
npm run test -- server/services/agent-learning.test.ts
```

Expected: FAIL because service does not exist.

**Step 3: Implement service**

Add:

- `buildAgentReflectionMessages`
- `parseAgentReflectionResult`
- `normalizeEvolutionProposal`
- `normalizeLearnedMemory`

The service should produce a strict JSON contract:

```json
{
  "summary": "...",
  "learned": [],
  "proposals": []
}
```

**Step 4: Run tests**

Run:

```bash
npm run test -- server/services/agent-learning.test.ts
```

Expected: PASS.

---

### Task 4: Run Learning After Chat Reply

**Files:**
- Modify: `server/api/chat/stream.post.ts`
- Modify: `server/services/minimax.ts`
- Test: `server/api/chat.post.test.ts`

**Step 1: Write failing API tests**

Cover:

- a successful chat stores one reflection.
- learned memories are stored under the current key.
- evolution proposals are stored as `pending`.
- learning failure still returns the chat reply.

**Step 2: Run failing tests**

Run:

```bash
npm run test -- server/api/chat.post.test.ts
```

Expected: FAIL.

**Step 3: Add MiniMax reflection helper**

Add a service client method that takes reflection messages and returns parsed JSON text.

Keep it separate from chat streaming.

**Step 4: Integrate after assistant conversation save**

In `server/api/chat/stream.post.ts`, after saving assistant reply:

1. Build agent reflection messages.
2. Call reflection helper.
3. Save `agent_reflections`.
4. Save valid memories.
5. Save valid evolution proposals as `pending`.

Wrap the whole learning block in `try/catch`.

**Step 5: Run tests**

Run:

```bash
npm run test -- server/api/chat.post.test.ts
```

Expected: PASS.

---

### Task 5: Add Agent Core API

**Files:**
- Create: `server/api/agent/core.get.ts`
- Create: `server/api/agent/proposals/[id].put.ts`
- Test: `server/api/agent.core.test.ts`

**Step 1: Write failing tests**

Cover:

- unauthenticated requests return 401.
- `GET /api/agent/core` returns profile, memory counts, latest reflections, and pending proposals.
- accepting a proposal updates status and writes a snapshot.
- rejecting a proposal updates status only.
- one key cannot mutate another key proposal.

**Step 2: Run failing tests**

Run:

```bash
npm run test -- server/api/agent.core.test.ts
```

Expected: FAIL.

**Step 3: Implement routes**

Add:

- `GET /api/agent/core`
- `PUT /api/agent/proposals/:id`

Request body for proposal update:

```ts
{ action: 'accept' | 'reject' }
```

For MVP, accepting a `tone` or `content_strategy` proposal updates stored profile fields only if those fields exist. Otherwise mark as `accepted`, save snapshot, and leave application for the next task.

**Step 4: Run tests**

Run:

```bash
npm run test -- server/api/agent.core.test.ts
```

Expected: PASS.

---

### Task 6: Inject Accepted Agent State Into Chat Prompt

**Files:**
- Modify: `server/services/star-chat.ts`
- Modify: `server/api/chat/stream.post.ts`
- Test: `server/services/star-chat.test.ts`
- Test: `server/api/chat.post.test.ts`

**Step 1: Write failing tests**

Cover:

- `buildStarChatMessages` includes agent tone and relationship role.
- rejected proposals are not included.
- active high-importance memories are included.
- archived or rejected memories are excluded.

**Step 2: Run failing tests**

Run:

```bash
npm run test -- server/services/star-chat.test.ts server/api/chat.post.test.ts
```

Expected: FAIL.

**Step 3: Update prompt builder input**

Extend `buildStarChatMessages` input with:

- `tone`
- `relationshipRole`
- `recentReflections`
- `acceptedEvolutionNotes`

Keep existing defaults.

**Step 4: Load accepted state in chat route**

In `server/api/chat/stream.post.ts`, load:

- active memories
- latest reflections
- accepted/applied proposal summaries

Pass them into `buildStarChatMessages`.

**Step 5: Run tests**

Run:

```bash
npm run test -- server/services/star-chat.test.ts server/api/chat.post.test.ts
```

Expected: PASS.

---

### Task 7: Build Agent Core Frontend

**Files:**
- Create: `composables/useAgentCore.ts`
- Create: `components/AgentCorePanel.vue`
- Modify: `pages/chat.vue`
- Test: `components/AgentCorePanel.test.ts`

**Step 1: Write failing component tests**

Cover:

- panel renders profile, memory counts, latest reflections, and pending proposals.
- accept button calls proposal update.
- reject button calls proposal update.
- empty state renders without crashing.

**Step 2: Run failing tests**

Run:

```bash
npm run test -- components/AgentCorePanel.test.ts
```

Expected: FAIL.

**Step 3: Add composable**

`useAgentCore.ts` should expose:

- `loadCore`
- `applyProposal`
- `core`
- `pending`
- `error`

**Step 4: Add panel**

Add a compact floating panel near the current `StarMemoryMap`.

Do not replace `ProfileSettingsSheet`.

**Step 5: Wire into `/chat`**

Mount `AgentCorePanel` in `pages/chat.vue`.

**Step 6: Run tests**

Run:

```bash
npm run test -- components/AgentCorePanel.test.ts
```

Expected: PASS.

---

### Task 8: End-To-End Verification

**Files:**
- Modify: `tests/e2e/main-flow.spec.ts`

**Step 1: Add e2e coverage**

Cover:

- unlock key.
- open chat.
- send a message.
- wait for assistant reply.
- open agent core.
- see reflection or pending proposal.

**Step 2: Run focused tests**

Run:

```bash
npm run test
npm run build
```

Expected: PASS.

**Step 3: Run e2e if local MiniMax stubs are available**

Run:

```bash
npm run test:e2e
```

Expected: PASS or documented skip if provider credentials are unavailable.

---

## Completion Criteria

- Each key has isolated agent learning state.
- Chat still works if reflection generation fails.
- Reflections are saved after successful chats.
- Evolution proposals are pending by default.
- Accepted proposals are reflected in later prompts.
- Rejected proposals are excluded from later prompts.
- Agent core panel displays state and lets the user accept or reject proposals.
- `npm run test` and `npm run build` pass.
