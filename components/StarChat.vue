<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import StarComposer from './StarComposer.vue'
import StarOrbitStage from './StarOrbitStage.vue'
import {
  useStarChat,
  type AttachmentKind,
  type StarChatAttachment,
  type StarChatIntent,
  type StarChatMessage,
  type StarChatPart,
  type StarChatReply,
  type StarChatSendPayload,
  type StarChatStreamEvent,
  type StarChatStreamHandler,
} from '../composables/useStarChat'

type MediaIntent = Exclude<StarChatIntent, 'auto' | 'chat'>
type ToolConfirmationPart = Extract<StarChatPart, { type: 'tool_confirmation' }>

const props = defineProps<{
  sendMessageStream?: (payload: StarChatSendPayload, onEvent: StarChatStreamHandler) => Promise<StarChatReply>
  initialMessages?: StarChatMessage[]
}>()

const input = ref('')
const pending = ref(false)
const error = ref('')
const localMessages = ref<StarChatMessage[]>([])
const attachments = ref<StarChatAttachment[]>([])
const selectedMediaKinds = ref<MediaIntent[]>([])
const listening = ref(false)
const threadActive = ref(false)
const activeMessageIndex = ref<number | null>(null)
const attachmentMenuOpen = ref(false)
const attachmentMenuRef = ref<HTMLElement | null>(null)
const messagesThreadRef = ref<{ $el: HTMLElement } | null>(null)
const chat = useStarChat()
let recognition: { start: () => void; stop?: () => void; abort?: () => void; lang: string; interimResults: boolean; onresult: ((event: any) => void) | null; onerror: (() => void) | null; onend: (() => void) | null } | null = null

type QueuedChatRequest = {
  id: number
  text: string
  attachments: StarChatAttachment[]
  intent: StarChatIntent
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

  if (target instanceof Node && attachmentMenuRef.value?.contains(target)) {
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

function toggleMediaKind(kind: MediaIntent) {
  selectedMediaKinds.value = selectedMediaKinds.value[0] === kind ? [] : [kind]
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

function buildThinkingStatusParts(intent: StarChatIntent, selectedAttachments: StarChatAttachment[]) {
  const statuses: string[] = []

  if (selectedAttachments.some(attachment => attachment.kind === 'image')) {
    statuses.push('正在看你发来的图片')
  }
  else if (selectedAttachments.some(attachment => attachment.kind === 'audio')) {
    statuses.push('正在听你的声音')
  }
  else if (selectedAttachments.some(attachment => attachment.kind === 'video')) {
    statuses.push('正在看这段影像里的光')
  }
  else {
    statuses.push('正在读你的话')
  }

  if (intent === 'audio') {
    statuses.push('先写好回复，再把它变成声音')
  }
  else if (intent === 'image') {
    statuses.push('正在把你的想法交给星图')
  }
  else if (intent === 'music') {
    statuses.push('正在酝酿一段旋律')
  }
  else if (intent === 'video') {
    statuses.push('正在整理成一段画面')
  }
  else {
    statuses.push('在星光里组织一句回复')
  }

  return statuses.slice(0, 2).map(text => ({ type: 'status' as const, text }))
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

function updateToolConfirmationStatus(inboxItemId: string, status: ToolConfirmationPart['status']) {
  localMessages.value = localMessages.value.map(message => ({
    ...message,
    parts: message.parts?.map(part => part.type === 'tool_confirmation' && part.inboxItemId === inboxItemId
      ? { ...part, status }
      : part),
  }))
}

async function approveInboxItem(part: ToolConfirmationPart) {
  await fetch(`/api/agents/current/inbox/${encodeURIComponent(part.inboxItemId)}/approve`, {
    method: 'POST',
    headers: withChatCsrfHeaders(),
  })
  updateToolConfirmationStatus(part.inboxItemId, 'approved')
}

async function rejectInboxItem(part: ToolConfirmationPart) {
  await fetch(`/api/agents/current/inbox/${encodeURIComponent(part.inboxItemId)}/reject`, {
    method: 'POST',
    headers: withChatCsrfHeaders(),
  })
  updateToolConfirmationStatus(part.inboxItemId, 'rejected')
}

function handleStreamEvent(index: number) {
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
      mergeFinalStreamMessage(index, event.message)
      await scrollMessagesToLatest()
    }
  }
}

async function submit() {
  const text = input.value.trim()
  const selectedAttachments = [...attachments.value]
  const selectedIntent: StarChatIntent = selectedMediaKinds.value[0] ?? 'auto'

  if (!text && selectedIntent !== 'auto') {
    error.value = '先写下想生成什么。'
    return
  }

  if (!text && selectedAttachments.length === 0) {
    return
  }

  error.value = ''
  input.value = ''
  attachments.value = []
  attachmentMenuOpen.value = false
  selectedMediaKinds.value = []
  chatQueue.value.push({
    id: nextQueuedChatRequestId++,
    text,
    attachments: selectedAttachments,
    intent: selectedIntent,
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

  try {
    localMessages.value.push({
      role: 'user',
      content: nextRequest.text || '发送了一个附件',
      parts: buildAttachmentParts(nextRequest.text || '发送了一个附件', nextRequest.attachments),
    })

    const payload = {
      message: nextRequest.text,
      attachments: nextRequest.attachments,
      intent: nextRequest.intent,
    }
    const streamMessage = props.sendMessageStream ?? chat.sendMessageStream
    const assistantMessage = createStreamingAssistantMessage(buildThinkingStatusParts(nextRequest.intent, nextRequest.attachments))
    const assistantIndex = localMessages.value.length
    localMessages.value.push(assistantMessage)
    const result = await streamMessage(payload, handleStreamEvent(assistantIndex))

    if (!result.message && result.reply) {
      applyStreamMessage(assistantIndex, {
        role: 'assistant',
        content: result.reply,
        parts: [{ type: 'text', text: result.reply }],
      })
    }
  }
  catch {
    error.value = '星信刚刚走神了，等一下再试。'
  }
  finally {
    pending.value = false

    if (chatQueue.value.length > 0) {
      void processChatQueue()
    }
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

      <div ref="attachmentMenuRef" class="star-chat__dock-stack">
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
          :selected-media-kinds="selectedMediaKinds"
          :attachment-menu-open="attachmentMenuOpen"
          @submit="submit"
          @focus="threadActive = true"
          @toggle-attachments="attachmentMenuOpen = !attachmentMenuOpen"
          @attachment-change="handleAttachmentChange"
          @start-voice="startVoiceInput"
          @toggle-media-kind="toggleMediaKind"
        />
      </div>
    </div>
  </aside>
</template>
