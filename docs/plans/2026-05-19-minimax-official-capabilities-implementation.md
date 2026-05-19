# MiniMax Official Capabilities Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Support the official MiniMax multimodal creation capabilities used by this product: file, speech, voice, image, music, and video.

**Architecture:** Keep chat as the product surface and Agent OS as the execution boundary. Add a MiniMax gateway layer that models official APIs directly, then expose safe product tools through `star.*` registry entries. Long-running and expiring provider outputs must persist through `media_tasks`, local blob storage, and `agent_works`.

**Tech Stack:** Nuxt 4, TypeScript, SQLite, Vitest, MiniMax REST APIs, MiniMax T2A WebSocket, existing Agent OS task queue, local blob storage.

---

## Official Capability Scope

This plan covers MiniMax official multimodal creation APIs. It does not cover general text chat compatibility, model-list APIs, Anthropic/OpenAI cache APIs, Token Plan MCP, pricing pages, or external coding-tool setup pages.

Support these MiniMax official areas:

- File management: upload, retrieve metadata, download content, list, delete.
- Voice cloning: upload clone audio, upload prompt audio, clone voice, store resulting `voice_id`.
- Voice design: text-to-voice prompt, preview audio, generated `voice_id`.
- Voice management: list system/cloned/generated voices, delete cloned/generated voices.
- Speech synthesis HTTP: short text to audio.
- Speech synthesis WebSocket: low-latency streamed TTS.
- Speech synthesis async: long text or uploaded text file to audio task, query, download result.
- Image generation: text-to-image, image-to-image, and subject reference image generation.
- Lyrics generation: write full song, edit/continue lyrics.
- Music generation: instrumental, song with lyrics, lyrics optimizer, stream/non-stream output.
- Music cover: one-step cover from reference audio, two-step preprocess plus generated cover.
- Video generation: text-to-video, image-to-video, first-last-frame video, subject-reference video, video Agent templates, query, download.

## Capability Matrix

| Area | Official APIs | Product support |
|---|---|---|
| File | upload, retrieve, download content, list, delete | Full server-side gateway. Provider IDs stay hidden. |
| Voice | clone, design, list, delete | Full support with consent, audit, and deletion flows. |
| Speech | HTTP TTS, WebSocket TTS, async TTS create/query/download | Short reply, streaming reply, and long narration. |
| Image | T2I, I2I, subject reference | Full support. Reference images come from attachments or stored blobs. |
| Music | lyrics, music generation, cover preprocess, cover generation | Full support. Covers instrumental, song, lyrics optimizer, one-step cover, two-step cover. |
| Video | T2V, I2V, FL2V, S2V, video Agent, query, download | Full support. Existing video tool becomes official gateway-backed. |
| Text chat/model APIs | OpenAI/Anthropic compatible chat, model list, cache | Existing chat provider remains. Not part of this media plan. |

## Product Boundary

Do not expose raw provider APIs directly to the browser.

Use three layers:

- `MiniMaxClient`: exact provider API methods and response normalization.
- `MediaTaskRepository`: durable task and provider output tracking.
- `star.*` tools: product-level capabilities the chat planner can call.

Raw `file_id`, `task_id`, hex audio, base64, provider download URLs, and trace IDs stay server-side unless needed for debugging.

Generated media should be copied to local blob storage before being shown as durable works.

## Provider Output Rules

- Provider URLs are temporary. Download them into local blob storage before creating a durable work.
- Hex audio is decoded server-side and stored as a blob.
- Base64 image/audio is decoded server-side and stored as a blob.
- `file_id`, `task_id`, trace IDs, raw provider URLs, and provider metadata stay in `media_tasks.output_json`.
- User-visible chat parts use local attachment or blob-backed URLs only.
- Expiring provider outputs need `expires_at`.

## Data Model

### Task 1: Expand media task persistence

**Files:**
- Modify: `server/db/schema.ts`
- Modify: `server/db/sqlite.ts`
- Test: `server/db/sqlite.test.ts`

**Step 1: Write failing tests**

Cover `media_tasks` storing:

- `provider`
- `provider_file_id`
- `input_json`
- `output_json`
- `result_blob_ref`
- `result_mime_type`
- `expires_at`

**Step 2: Run tests**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected: fail because fields do not exist.

**Step 3: Add schema columns and migration guards**

Use `ensureColumn()` in `server/db/sqlite.ts` so existing SQLite files migrate in place.

**Step 4: Update repository mapping**

Extend `MediaTaskRecord`, `addMediaTask()`, `getMediaTask()`, `getMediaTaskByKey()`, and `updateMediaTask()`.

**Step 5: Verify**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected: pass.

### Task 2: Add voice profile persistence

**Files:**
- Modify: `server/db/schema.ts`
- Modify: `server/db/sqlite.ts`
- Test: `server/db/sqlite.test.ts`

**Step 1: Write failing tests**

Add repository tests for `key_voice_profiles`:

- create system voice selection
- create cloned voice profile
- create generated voice profile
- update default voice
- mark deleted
- list by `key_id`

**Step 2: Add table**

Fields:

```text
id
key_id
provider
voice_id
voice_type
label
description_json
preview_blob_ref
consent_json
status
is_default
created_at
updated_at
```

`voice_type` values:

```text
system | voice_cloning | voice_generation | music
```

**Step 3: Add repository**

Add `createVoiceProfileRepository(path)`.

**Step 4: Verify**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected: pass.

### Task 3: Add voice consent and audit persistence

**Files:**
- Modify: `server/db/schema.ts`
- Modify: `server/db/sqlite.ts`
- Test: `server/db/sqlite.test.ts`

**Step 1: Write failing tests**

Cover:

- create consent record for voice clone
- store consent text and actor confirmation
- link consent to `key_voice_profiles`
- mark revoked
- list audit events by `key_id`

**Step 2: Add tables**

Add `voice_consents`:

```text
id
key_id
voice_profile_id
subject_label
relationship
consent_text
source_attachment_id
status
created_at
revoked_at
```

Add `voice_events`:

```text
id
key_id
voice_profile_id
action
before_json
after_json
reason
created_at
```

**Step 3: Add repository methods**

Add consent creation, revoke, and event insert/list methods.

**Step 4: Verify**

Run:

```bash
npm run test -- server/db/sqlite.test.ts
```

Expected: pass.

## Storage

### Task 4: Add blob persistence for provider outputs

**Files:**
- Modify: `server/services/blob-storage.ts`
- Test: `server/services/blob-storage.test.ts`

**Step 1: Write failing tests**

Cover:

- write bytes with MIME type
- write base64 media
- write hex audio
- download provider URL and write blob
- reject unsupported MIME type

**Step 2: Implement helpers**

Add:

```ts
writeBlobBytes()
writeBlobBase64()
writeBlobHex()
downloadProviderAssetToBlob()
```

**Step 3: Verify**

Run:

```bash
npm run test -- server/services/blob-storage.test.ts
```

Expected: pass.

## MiniMax Gateway

### Task 5: Add official file APIs

**Files:**
- Modify: `server/services/minimax.ts`
- Test: `server/services/minimax.test.ts`

**Step 1: Write failing tests**

Cover:

- `uploadFile({ purpose, filename, mimeType, data })`
- `uploadCloneAudio({ filename, mimeType, data })`
- `uploadPromptAudio({ filename, mimeType, data })`
- `retrieveFile(fileId)`
- `downloadFile(fileId)`
- `listFiles({ purpose? })`
- `deleteFile(fileId)`

**Step 2: Implement multipart upload**

Use `FormData`, `Blob`, and `fetch`.

Supported purposes needed by this plan:

```text
voice_clone
prompt_audio
t2a_async_input
```

Expose `uploadCloneAudio()` and `uploadPromptAudio()` as typed wrappers over the same official `/v1/files/upload` endpoint so voice cloning does not rely on callers passing raw purpose strings.

**Step 3: Verify**

Run:

```bash
npm run test -- server/services/minimax.test.ts
```

Expected: pass.

### Task 6: Add voice clone, design, and management

**Files:**
- Modify: `server/services/minimax.ts`
- Test: `server/services/minimax.test.ts`

**Step 1: Write failing tests**

Cover:

- `cloneVoice()`
- `designVoice()`
- `getVoices()`
- `deleteVoice()`

**Step 2: Implement official endpoints**

Endpoints:

```text
POST /v1/voice_clone
POST /v1/voice_design
POST /v1/get_voice
POST /v1/delete_voice
```

Normalize preview audio:

- URL preview from clone response: keep as temporary provider URL until copied.
- Hex preview from voice design: convert to base64 or blob.

**Step 3: Verify**

Run:

```bash
npm run test -- server/services/minimax.test.ts
```

Expected: pass.

### Task 7: Complete speech synthesis support

**Files:**
- Modify: `server/services/minimax.ts`
- Modify: `package.json`
- Test: `server/services/minimax.test.ts`

**Step 1: Write failing tests**

Cover:

- HTTP TTS with configurable `voice_id`, model, speed, volume, pitch, format.
- WebSocket TTS yields hex chunks and final metadata.
- Async TTS create task.
- Async TTS query task.
- Async TTS result download through file API.

**Step 2: Keep HTTP TTS for short replies**

Existing `textToSpeech()` becomes configurable.

**Step 3: Add WebSocket runtime dependency**

Use one explicit runtime path:

- If the Node version in this project exposes global `WebSocket`, use it and add tests that mock `globalThis.WebSocket`.
- If not, add `ws` as a runtime dependency and `@types/ws` as a dev dependency, then wrap it behind a tiny adapter.

The adapter must expose:

```ts
connectMiniMaxT2AWebSocket(apiKey: string): Promise<MiniMaxT2AWebSocket>
```

**Step 4: Add WebSocket TTS**

Endpoint:

```text
wss://api.minimaxi.com/ws/v1/t2a_v2
```

Use events:

```text
task_start
task_continue
task_finish
```

Tests must mock the socket lifecycle:

```text
connected_success -> task_started -> audio chunks -> is_final -> close
```

**Step 5: Add async TTS**

Endpoints:

```text
POST /v1/t2a_async_v2
GET /v1/query/t2a_async_query_v2?task_id=...
```

**Step 6: Verify**

Run:

```bash
npm run test -- server/services/minimax.test.ts
```

Expected: pass.

### Task 8: Complete image generation support

**Files:**
- Modify: `server/services/minimax.ts`
- Test: `server/services/minimax.test.ts`

**Step 1: Write failing tests**

Cover:

- text-to-image
- image-to-image with source image
- subject-reference image generation
- `data.image_base64`
- provider URL response

**Step 2: Extend input**

Support:

```ts
{
  prompt: string
  aspectRatio?: string
  responseFormat?: 'url' | 'base64'
  image?: { url?: string, base64?: string }
  subjectReference?: Array<{ type: 'character', imageFile: string }>
}
```

**Step 3: Implement separate payload builders**

Add separate builders for:

```text
buildTextToImagePayload()
buildImageToImagePayload()
buildSubjectReferenceImagePayload()
```

Do not treat subject reference as the only image-to-image path.

**Step 4: Verify**

Run:

```bash
npm run test -- server/services/minimax.test.ts
```

Expected: pass.

### Task 9: Complete music and lyrics support

**Files:**
- Modify: `server/services/minimax.ts`
- Test: `server/services/minimax.test.ts`

**Step 1: Write failing tests**

Cover:

- lyrics generation full song
- lyrics edit
- instrumental generation
- song generation with lyrics
- song generation with lyrics optimizer
- streaming music generation
- music cover one-step
- music cover preprocess
- music cover two-step

**Step 2: Implement endpoints**

Endpoints:

```text
POST /v1/lyrics_generation
POST /v1/music_generation
POST /v1/music_cover_preprocess
```

**Step 3: Normalize outputs**

Support:

- URL audio
- hex audio
- metadata under `extra_info`
- cover feature ID
- formatted lyrics

**Step 4: Verify**

Run:

```bash
npm run test -- server/services/minimax.test.ts
```

Expected: pass.

### Task 10: Complete official video support

**Files:**
- Modify: `server/services/minimax.ts`
- Test: `server/services/minimax.test.ts`

**Step 1: Write failing tests**

Cover:

- text-to-video task create
- image-to-video task create
- first-last-frame video task create
- subject-reference video task create
- video Agent task create
- query video generation task
- query video Agent task
- download generated video

**Step 2: Implement endpoints**

Implement official video endpoints from the MiniMax API reference:

```text
video-generation-t2v
video-generation-i2v
video-generation-fl2v
video-generation-s2v
video-agent-create
video-agent-query
video-generation-query
video-generation-download
```

**Step 3: Normalize task outputs**

Return one normalized shape:

```ts
{
  providerTaskId: string
  providerFileId?: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  url?: string
  output?: unknown
}
```

**Step 4: Verify**

Run:

```bash
npm run test -- server/services/minimax.test.ts
```

Expected: pass.

## Product Tools

### Task 11: Replace narrow media tool inputs with official capability inputs

**Files:**
- Modify: `server/services/star-agent-tools.ts`
- Modify: `server/services/star-agent-runtime.ts`
- Test: `server/services/star-agent-tools.test.ts`

**Step 1: Write failing tests**

Cover new tools:

```text
star.listVoices
star.setDefaultVoice
star.cloneVoice
star.designVoice
star.deleteVoice
star.speakReply
star.generateNarration
star.generateImage
star.generateLyrics
star.generateMusic
star.preprocessMusicCover
star.generateMusicCover
star.generateVideo
star.generateImageVideo
star.generateFirstLastFrameVideo
star.generateSubjectReferenceVideo
star.generateVideoAgent
```

**Step 2: Define risk**

Low risk:

```text
star.listVoices
star.speakReply
star.generateImage
star.generateLyrics
star.generateMusic
star.generateNarration
star.generateVideo
star.generateImageVideo
```

High risk:

```text
star.cloneVoice
star.designVoice
star.deleteVoice
star.setDefaultVoice
star.generateMusicCover
star.generateFirstLastFrameVideo
star.generateSubjectReferenceVideo
star.generateVideoAgent
```

Voice cloning requires explicit consent payload:

```ts
{
  subjectLabel: string
  relationship: string
  consentText: string
  sourceAttachmentId: string
}
```

The tool must reject missing consent before calling MiniMax.

**Step 3: Update runtime wiring**

Use `createMiniMaxClient()` methods through `registerDefaultStarAgentTools()`.

**Step 4: Verify**

Run:

```bash
npm run test -- server/services/star-agent-tools.test.ts
```

Expected: pass.

### Task 12: Add product APIs for voices and media tasks

**Files:**
- Create: `server/api/key/voices.get.ts`
- Create: `server/api/key/voices/default.put.ts`
- Create: `server/api/key/voices/clone.post.ts`
- Create: `server/api/key/voices/design.post.ts`
- Create: `server/api/key/voices/[id].delete.ts`
- Create: `server/api/media/tasks/[id].get.ts`
- Create: `server/api/media/tasks/[id]/refresh.post.ts`
- Test: `server/api/key/voices.test.ts`
- Test: `server/api/media/tasks.test.ts`

**Step 1: Write failing tests**

Cover:

- session required
- CSRF required for mutations
- voice list hides provider internals
- default voice persists
- clone voice requires consent
- delete voice requires approval-sensitive path
- media task status is scoped by `key_id`
- refresh advances provider status

**Step 2: Implement API routes**

Routes return product shapes only. Do not return provider `file_id`, `task_id`, raw URL, or trace ID.

**Step 3: Verify**

Run:

```bash
npm run test -- server/api/key/voices.test.ts server/api/media/tasks.test.ts
```

Expected: pass.

### Task 13: Make long-running tools recoverable

**Files:**
- Modify: `server/services/star-agent-tools.ts`
- Create: `server/services/media-task-runner.ts`
- Modify: `server/api/agents/current/tasks/[id].put.ts`
- Modify: `server/api/agents/current/inbox/[id]/approve.post.ts`
- Modify: `server/api/media/tasks/[id].get.ts`
- Modify: `server/api/media/tasks/[id]/refresh.post.ts`
- Test: `server/services/star-agent-tools.test.ts`
- Test: `server/services/media-task-runner.test.ts`
- Test: `server/api/chat.post.test.ts`

**Step 1: Write failing tests**

Cover:

- async TTS task survives immediate response
- video task survives immediate response
- music task persists input and output
- failed provider task stores error
- completed provider URL is downloaded to blob storage
- `refresh` polls provider and updates task
- expired provider output is marked failed when it cannot be downloaded

**Step 2: Replace fire-and-forget Promise**

Do not leave music generation only in a background `void Promise`.

Use durable `media_tasks` state and explicit polling/resume entry points.

`media-task-runner.ts` owns:

```ts
advanceMediaTask(taskId)
advancePendingMediaTasks({ keyId, limit })
downloadCompletedProviderOutput(task)
```

Recovery rules:

- Chat execution creates a `media_tasks` row before provider task creation when possible.
- If provider returns a task ID, store it immediately.
- `GET /api/media/tasks/[id]` returns current local state.
- `POST /api/media/tasks/[id]/refresh` polls MiniMax and downloads completed output.
- Agent task resume paths call `advanceMediaTask()`.
- App startup does not need a background worker in phase one; recovery happens on task read, task refresh, and agent resume.

**Step 3: Verify**

Run:

```bash
npm run test -- server/services/star-agent-tools.test.ts server/services/media-task-runner.test.ts server/api/chat.post.test.ts
```

Expected: pass.

## UI and Chat Surface

### Task 14: Add voice and media controls without raw provider leakage

**Files:**
- Modify: `composables/useStarChat.ts`
- Create: `composables/useVoiceProfiles.ts`
- Modify: `components/ProfileSettingsSheet.vue`
- Modify: `components/StarChatMessage.vue`
- Modify: `components/StarMediaCard.vue`
- Test: related component tests

**Step 1: Write failing tests**

Cover:

- voice list renders grouped voices
- default voice can be selected
- cloned/generated voice states render
- async task card renders processing, completed, failed
- no provider IDs appear in user-visible text
- refresh button calls product media task API

**Step 2: Implement UI**

Add:

- default voice picker
- clone/design voice action cards
- long narration task card
- music lyrics and cover result cards
- video task result cards
- task refresh action

**Step 3: Verify**

Run:

```bash
npm run test -- components/ProfileSettingsSheet.test.ts components/StarChatMessage.test.ts components/StarMediaCard.test.ts
```

Expected: pass.

## Final Verification

### Task 15: Full test and build

**Files:**
- Existing test suite

**Step 1: Run unit tests**

Run:

```bash
npm run test
```

Expected: pass.

**Step 2: Run build**

Run:

```bash
npm run build
```

Expected: pass.

**Step 3: Manual smoke test**

Run:

```bash
npm run dev
```

Verify:

- short voice reply
- long narration task
- system voice selection
- image generation with text
- image generation with reference image
- lyrics generation
- instrumental music
- song generation
- music cover preprocess
- text-to-video task
- image-to-video task
- first-last-frame video task
- subject-reference video task
- video Agent task
- voice design preview
- voice clone approval flow
