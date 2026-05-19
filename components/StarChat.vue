<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import StarComposer from './StarComposer.vue'
import StarOrbitStage from './StarOrbitStage.vue'
import {
  useStarChat,
  type AttachmentKind,
  type StarChatAttachment,
  type StarChatMessage,
  type StarChatPart,
  type StarChatReply,
  type StarChatSendPayload,
  type StarChatStreamEvent,
  type StarChatStreamHandler,
} from '../composables/useStarChat'

type ToolConfirmationPart = Extract<StarChatPart, { type: 'tool_confirmation' }>
type MediaTaskStatus = 'pending' | 'processing' | 'succeeded' | 'failed'
type MediaTaskResponse = {
  task?: {
    id: string
    type: 'tts' | 'image' | 'video' | 'music'
    status: MediaTaskStatus
    resultUrl?: string | null
    error?: string | null
  }
}

const mediaTaskPollDelayMs = 2000
const mediaTaskPollLimit = 300

const props = defineProps<{
  sendMessageStream?: (payload: StarChatSendPayload, onEvent: StarChatStreamHandler) => Promise<StarChatReply>
  initialMessages?: StarChatMessage[]
}>()

const input = ref('')
const pending = ref(false)
const error = ref('')
const localMessages = ref<StarChatMessage[]>([])
const attachments = ref<StarChatAttachment[]>([])
const listening = ref(false)
const threadActive = ref(false)
const activeMessageIndex = ref<number | null>(null)
const attachmentMenuOpen = ref(false)
const messagesThreadRef = ref<{ $el: HTMLElement } | null>(null)
const chat = useStarChat()
let recognition: { start: () => void; stop?: () => void; abort?: () => void; lang: string; interimResults: boolean; onresult: ((event: any) => void) | null; onerror: (() => void) | null; onend: (() => void) | null } | null = null
let activeChatRunToken = 0
let componentUnmounted = false

type QueuedChatRequest = {
  id: number
  text: string
  attachments: StarChatAttachment[]
}

const chatQueue = ref<QueuedChatRequest[]>([])
let nextQueuedChatRequestId = 1

const attachmentRules: Record<AttachmentKind, { mimeTypes: string[], maxSize: number, label: string }> = {
  image: {
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    maxSize: 2_000_000,
    label: '图片需要是 2MB 内的 PNG、JPG 或 WebP。',
  },
  audio: {
    mimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/wav', 'audio/webm'],
    maxSize: 8_000_000,
    label: '音频需要是 8MB 内的 MP3、M4A、WAV 或 WebM。',
  },
  video: {
    mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    maxSize: 20_000_000,
    label: '视频需要是 20MB 内的 MP4、WebM 或 MOV。',
  },
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Image read failed'))
    reader.readAsDataURL(file)
  })
}

function getAttachmentKind(file: File): AttachmentKind | undefined {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
}

async function handleAttachmentChange(event: Event, expectedKind: AttachmentKind) {
  const files = Array.from((event.target as HTMLInputElement).files ?? []).slice(0, 3)

  if (files.length === 0) {
    return
  }

  try {
    const nextAttachments: StarChatAttachment[] = []

    for (const file of files) {
      const kind = getAttachmentKind(file)

      if (kind !== expectedKind) {
        const kindLabel: Record<AttachmentKind, string> = {
          image: '图片',
          audio: '音频',
          video: '视频',
        }
        error.value = `请选择${kindLabel[expectedKind]}文件。`
        return
      }

      const rule = attachmentRules[kind]

      if (!rule.mimeTypes.includes(file.type) || file.size > rule.maxSize) {
        error.value = rule.label
        return
      }

      nextAttachments.push({
        kind,
        dataUrl: await readFileAsDataUrl(file),
        name: file.name,
        mimeType: file.type,
      })
    }

    attachments.value = nextAttachments
    attachmentMenuOpen.value = false
    error.value = ''
  }
  catch {
    error.value = '附件没有读到。'
  }
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!attachmentMenuOpen.value) {
    return
  }

  const target = event.target

  if (target instanceof Element && target.closest('.star-chat__attachment-menu')) {
    return
  }

  attachmentMenuOpen.value = false
}

async function scrollMessagesToLatest() {
  await nextTick()
  const root = messagesThreadRef.value?.$el
  const thread = root?.querySelector('.star-chat__messages') as HTMLElement | null

  if (!thread && !root) {
    return
  }

  const target = thread ?? root

  if (typeof target.scrollTo === 'function') {
    target.scrollTo({
      top: target.scrollHeight,
      behavior: 'smooth',
    })
    return
  }

  target.scrollTop = target.scrollHeight
}

function removeAttachment(index: number) {
  attachments.value.splice(index, 1)
}

function removeQueuedChatRequest(id: number) {
  chatQueue.value = chatQueue.value.filter(request => request.id !== id)
}

function startVoiceInput() {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

  if (!SpeechRecognition) {
    error.value = '当前浏览器不支持语音输入。'
    return
  }

  recognition?.abort?.()
  recognition = new SpeechRecognition()
  recognition.lang = 'zh-CN'
  recognition.interimResults = false
  recognition.onresult = (event: any) => {
    const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim()

    if (transcript) {
      input.value = input.value ? `${input.value} ${transcript}` : transcript
    }
  }
  recognition.onerror = () => {
    error.value = '语音没有听清。'
  }
  recognition.onend = () => {
    listening.value = false
  }

  listening.value = true
  recognition.start()
}

function buildAttachmentParts(text: string, selectedAttachments: StarChatAttachment[]) {
  const parts: StarChatPart[] = text ? [{ type: 'text', text }] : []

  for (const attachment of selectedAttachments) {
    if (attachment.kind === 'image') {
      parts.push({ type: 'image', url: attachment.dataUrl })
    }

    if (attachment.kind === 'audio') {
      parts.push({ type: 'audio', url: attachment.dataUrl })
    }

    if (attachment.kind === 'video') {
      parts.push({ type: 'video', url: attachment.dataUrl })
    }
  }

  return parts
}

async function copyMessage(message: StarChatMessage) {
  const text = message.content.trim()

  if (!text || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return
  }

  await navigator.clipboard.writeText(text)
}

function getLetterCsrfToken() {
  if (typeof document === 'undefined') {
    return ''
  }

  const cookie = document.cookie
    .split('; ')
    .find(item => item.startsWith('letter_csrf='))

  return cookie ? decodeURIComponent(cookie.slice('letter_csrf='.length)) : ''
}

function withChatCsrfHeaders(headers: HeadersInit = {}) {
  const token = getLetterCsrfToken()

  return {
    ...headers,
    ...(token ? { 'x-letter-csrf': token } : {}),
  }
}

function createStreamingAssistantMessage(parts: StarChatPart[]) {
  return {
    role: 'assistant' as const,
    content: '',
    parts,
  }
}

function waitForVisibleStreamPaint() {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve())
      return
    }

    setTimeout(resolve, 0)
  })
}

function applyStreamDelta(index: number, text: string) {
  const message = localMessages.value[index]

  if (!message) {
    return
  }

  let hasTextPart = false
  const parts = (message.parts ?? [])
    .filter(part => part.type !== 'status')
    .map((part) => {
      if (part.type !== 'text') {
        return part
      }

      hasTextPart = true
      return {
        ...part,
        text: part.text + text,
      }
    })

  if (!hasTextPart) {
    parts.push({ type: 'text', text })
  }

  applyStreamMessage(index, {
    ...message,
    content: message.content + text,
    parts,
  })
}

async function applyStreamDeltaByCharacter(index: number, text: string) {
  for (const character of Array.from(text)) {
    applyStreamDelta(index, character)
    await scrollMessagesToLatest()
    await waitForVisibleStreamPaint()
  }
}

function applyStreamMessage(index: number, message: StarChatMessage) {
  localMessages.value.splice(index, 1, message)
}

function appendStreamPart(index: number, part: StarChatPart) {
  const message = localMessages.value[index]

  if (!message) {
    return
  }

  applyStreamMessage(index, {
    ...message,
    content: message.content || (part.type === 'status' ? part.text : message.content),
    parts: [...(message.parts ?? []), part],
  })
}

function mergeFinalStreamMessage(index: number, message: StarChatMessage) {
  const existingConfirmations = localMessages.value[index]?.parts
    ?.filter((part): part is ToolConfirmationPart => part.type === 'tool_confirmation') ?? []
  const nextParts = [...(message.parts ?? [])]
  const knownInboxItems = new Set(nextParts
    .filter((part): part is ToolConfirmationPart => part.type === 'tool_confirmation')
    .map(part => part.inboxItemId))

  for (const part of existingConfirmations) {
    if (!knownInboxItems.has(part.inboxItemId)) {
      nextParts.push(part)
    }
  }

  applyStreamMessage(index, {
    ...message,
    parts: nextParts,
  })
}

function applyStreamError(index: number, message: string) {
  applyStreamMessage(index, {
    role: 'assistant',
    content: message,
    parts: [{ type: 'status', text: message }],
  })
}

function needsStreamFallback(message?: StarChatMessage) {
  if (!message || message.content.trim()) {
    return false
  }

  return !(message.parts ?? []).some(part => part.type !== 'status')
}

function getProcessingMediaTaskIds(message?: StarChatMessage) {
  return message?.parts
    ?.filter((part): part is Extract<StarChatPart, { type: 'music' }> =>
      part.type === 'music'
      && part.status === 'processing'
      && typeof part.taskId === 'string'
      && Boolean(part.taskId),
    )
    .map(part => part.taskId) ?? []
}

function updateMediaTaskPart(index: number, task: NonNullable<MediaTaskResponse['task']>) {
  const message = localMessages.value[index]

  if (!message) {
    return
  }

  applyStreamMessage(index, {
    ...message,
    parts: message.parts?.map((part) => {
      if (part.type !== 'music' || part.taskId !== task.id) {
        return part
      }

      if (task.status === 'succeeded') {
        return {
          ...part,
          status: 'succeeded',
          ...(task.resultUrl ? { url: task.resultUrl } : {}),
        }
      }

      if (task.status === 'failed') {
        return {
          ...part,
          status: 'failed',
          error: task.error ?? 'Music generation failed',
        }
      }

      return {
        ...part,
        status: 'processing',
      }
    }),
  })
}

function wait(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function fetchMediaTask(taskId: string): Promise<NonNullable<MediaTaskResponse['task']>> {
  const response = await fetch(`/api/media/tasks/${encodeURIComponent(taskId)}`)

  if (!response.ok) {
    throw new Error('Media task status request failed')
  }

  const body = await response.json() as MediaTaskResponse

  if (!body.task) {
    throw new Error('Media task response is missing task')
  }

  return body.task
}

async function pollMediaTaskUntilSettled(index: number, taskId: string, runToken: number) {
  for (let attempt = 0; attempt < mediaTaskPollLimit; attempt += 1) {
    if (componentUnmounted || activeChatRunToken !== runToken) {
      return
    }

    try {
      const task = await fetchMediaTask(taskId)

      updateMediaTaskPart(index, task)

      if (task.status === 'succeeded' || task.status === 'failed') {
        return
      }
    }
    catch {
      if (attempt >= 2) {
        updateMediaTaskPart(index, {
          id: taskId,
          type: 'music',
          status: 'failed',
          error: 'Media task status request failed',
        })
        return
      }
    }

    await wait(mediaTaskPollDelayMs)
  }

  updateMediaTaskPart(index, {
    id: taskId,
    type: 'music',
    status: 'failed',
    error: 'Media task timed out',
  })
}

function updateToolConfirmationStatus(inboxItemId: string, status: ToolConfirmationPart['status']) {
  localMessages.value = localMessages.value.map(message => ({
    ...message,
    parts: message.parts?.map(part => part.type === 'tool_confirmation' && part.inboxItemId === inboxItemId
      ? { ...part, status }
      : part),
  }))
}

async function approveInboxItem(part: ToolConfirmationPart) {
  updateToolConfirmationStatus(part.inboxItemId, 'submitting')

  try {
    await fetch(`/api/agents/current/inbox/${encodeURIComponent(part.inboxItemId)}/approve`, {
      method: 'POST',
      headers: withChatCsrfHeaders(),
    })
    updateToolConfirmationStatus(part.inboxItemId, 'approved')
  }
  catch (error) {
    updateToolConfirmationStatus(part.inboxItemId, undefined)
    throw error
  }
}

async function rejectInboxItem(part: ToolConfirmationPart) {
  updateToolConfirmationStatus(part.inboxItemId, 'submitting')

  try {
    await fetch(`/api/agents/current/inbox/${encodeURIComponent(part.inboxItemId)}/reject`, {
      method: 'POST',
      headers: withChatCsrfHeaders(),
    })
    updateToolConfirmationStatus(part.inboxItemId, 'rejected')
  }
  catch (error) {
    updateToolConfirmationStatus(part.inboxItemId, undefined)
    throw error
  }
}

function handleStreamEvent(index: number, markVisibleCompleteWhenReady: () => void) {
  let finalized = false

  return async (event: StarChatStreamEvent) => {
    if (event.type === 'delta') {
      await applyStreamDeltaByCharacter(index, event.text)
      return
    }

    if (event.type === 'status') {
      applyStreamMessage(index, {
        role: 'assistant',
        content: event.text,
        parts: [{ type: 'status', text: event.text }],
      })
      await scrollMessagesToLatest()
      await waitForVisibleStreamPaint()
      return
    }

    if (event.type === 'tool-status') {
      if (event.visibility === 'debug') {
        return
      }

      appendStreamPart(index, { type: 'status', text: event.text })
      await scrollMessagesToLatest()
      await waitForVisibleStreamPaint()
      return
    }

    if (event.type === 'tool-confirmation') {
      appendStreamPart(index, {
        type: 'tool_confirmation',
        taskId: event.taskId,
        inboxItemId: event.inboxItemId,
        title: event.title,
        summary: event.summary,
        status: 'pending',
      })
      await scrollMessagesToLatest()
      await waitForVisibleStreamPaint()
      return
    }

    if (event.type === 'message') {
      finalized = true
      mergeFinalStreamMessage(index, event.message)
      await scrollMessagesToLatest()
      markVisibleCompleteWhenReady()
      return
    }

    if (event.type === 'error') {
      if (finalized) {
        return
      }

      applyStreamError(index, event.message)
      error.value = event.message
      await scrollMessagesToLatest()
      markVisibleCompleteWhenReady()
    }
  }
}

async function submit() {
  const text = input.value.trim()
  const selectedAttachments = [...attachments.value]

  if (!text && selectedAttachments.length === 0) {
    return
  }

  error.value = ''
  input.value = ''
  attachments.value = []
  attachmentMenuOpen.value = false
  chatQueue.value.push({
    id: nextQueuedChatRequestId++,
    text,
    attachments: selectedAttachments,
  })

  void processChatQueue()
}

async function processChatQueue() {
  if (pending.value) {
    return
  }

  const nextRequest = chatQueue.value.shift()

  if (!nextRequest) {
    return
  }

  pending.value = true
  const runToken = activeChatRunToken + 1
  activeChatRunToken = runToken
  let visibleComplete = false
  let assistantIndex: number | null = null
  let mediaCompletionPromise: Promise<void> | null = null
  const markVisibleComplete = () => {
    if (visibleComplete) {
      return
    }

    visibleComplete = true

    if (activeChatRunToken !== runToken) {
      return
    }

    pending.value = false

    if (chatQueue.value.length > 0) {
      void processChatQueue()
    }
  }
  const markVisibleCompleteWhenReady = () => {
    if (assistantIndex === null) {
      markVisibleComplete()
      return
    }

    const taskIds = getProcessingMediaTaskIds(localMessages.value[assistantIndex])

    if (taskIds.length < 1) {
      markVisibleComplete()
      return
    }

    if (!mediaCompletionPromise) {
      mediaCompletionPromise = Promise.all(
        taskIds.map(taskId => pollMediaTaskUntilSettled(assistantIndex!, taskId, runToken)),
      ).then(() => {
        markVisibleComplete()
      })
    }
  }

  try {
    localMessages.value.push({
      role: 'user',
      content: nextRequest.text || '发送了一个附件',
      parts: buildAttachmentParts(nextRequest.text || '发送了一个附件', nextRequest.attachments),
    })

    const payload = {
      message: nextRequest.text,
      attachments: nextRequest.attachments,
    }
    const streamMessage = props.sendMessageStream ?? chat.sendMessageStream
    const assistantMessage = createStreamingAssistantMessage([])
    assistantIndex = localMessages.value.length
    localMessages.value.push(assistantMessage)
    const result = await streamMessage(payload, handleStreamEvent(assistantIndex, markVisibleCompleteWhenReady))

    if (!result.message && result.reply) {
      applyStreamMessage(assistantIndex, {
        role: 'assistant',
        content: result.reply,
        parts: [{ type: 'text', text: result.reply }],
      })
      markVisibleCompleteWhenReady()
    }
    else if (!result.message && !result.reply && assistantIndex !== null && needsStreamFallback(localMessages.value[assistantIndex])) {
      applyStreamError(assistantIndex, '星信刚刚走神了，等一下再试。')
      markVisibleCompleteWhenReady()
    }
  }
  catch {
    if (assistantIndex !== null && needsStreamFallback(localMessages.value[assistantIndex])) {
      applyStreamError(assistantIndex, '星信刚刚走神了，等一下再试。')
    }
    error.value = '星信刚刚走神了，等一下再试。'
    markVisibleCompleteWhenReady()
  }
  finally {
    markVisibleCompleteWhenReady()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

watch(
  () => props.initialMessages,
  (messages) => {
    if (localMessages.value.length === 0 && messages?.length) {
      localMessages.value = [...messages]
    }
  },
  { immediate: true },
)

watch(
  () => localMessages.value.length,
  () => {
    void scrollMessagesToLatest()
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  componentUnmounted = true
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  recognition?.abort?.()
})
</script>

<template>
  <aside
    class="star-chat star-chat--bottom"
    aria-label="星信"
    :data-thread-active="String(threadActive)"
  >
    <div class="star-chat__note">
      <StarOrbitStage
        ref="messagesThreadRef"
        :messages="localMessages"
        :active-message-index="activeMessageIndex"
        @interact="threadActive = true"
        @activate="activeMessageIndex = $event"
        @copy="copyMessage"
        @approve-tool="approveInboxItem"
        @reject-tool="rejectInboxItem"
      />

      <div v-if="attachments.length" class="star-chat__attachment-preview">
        <article v-for="(attachment, index) in attachments" :key="`${attachment.name}-${index}`">
          <img v-if="attachment.kind === 'image'" :src="attachment.dataUrl" alt="">
          <span v-else>{{ attachment.kind === 'audio' ? '音' : '视' }}</span>
          <p>{{ attachment.name }}</p>
          <button type="button" @click="removeAttachment(index)">
            移除
          </button>
        </article>
      </div>

      <p v-if="error" class="star-chat__error" role="alert">
        {{ error }}
      </p>

      <div class="star-chat__dock-stack">
        <div
          v-if="chatQueue.length"
          class="star-chat__queue"
          role="status"
          aria-label="等待发送的消息"
        >
          <div class="star-chat__queue-header">
            <span>排队中</span>
            <strong>{{ chatQueue.length }}</strong>
          </div>
          <article
            v-for="request in chatQueue"
            :key="request.id"
            class="star-chat__queue-item"
          >
            <p>{{ request.text || '发送了一个附件' }}</p>
            <small v-if="request.attachments.length">
              {{ request.attachments.length }} 个附件
            </small>
            <button
              type="button"
              class="star-chat__queue-remove"
              :aria-label="`删除排队消息：${request.text || '附件'}`"
              @click="removeQueuedChatRequest(request.id)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M6 7l1 13h10l1-13" />
                <path d="M9 7V4h6v3" />
              </svg>
            </button>
          </article>
        </div>
        <StarComposer
          v-model:input="input"
          :pending="pending"
          :listening="listening"
          :attachment-menu-open="attachmentMenuOpen"
          @submit="submit"
          @focus="threadActive = true"
          @toggle-attachments="attachmentMenuOpen = !attachmentMenuOpen"
          @attachment-change="handleAttachmentChange"
          @start-voice="startVoiceInput"
        />
      </div>
    </div>
  </aside>
</template>
