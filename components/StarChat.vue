<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import StarComposer from './StarComposer.vue'
import StarMagicStage from './StarMagicStage.vue'
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

const props = defineProps<{
  sendMessageStream?: (payload: StarChatSendPayload, onEvent: StarChatStreamHandler) => Promise<StarChatReply>
  initialMessages?: StarChatMessage[]
}>()

const emit = defineEmits<{
  designRequested: [instruction: string]
}>()

const input = ref('')
const pending = ref(false)
const error = ref('')
const localMessages = ref<StarChatMessage[]>([])
const attachments = ref<StarChatAttachment[]>([])
const selectedMediaKinds = ref<MediaIntent[]>([])
const listening = ref(false)
const mode = ref<'chat' | 'design'>('chat')
const threadActive = ref(false)
const activeMessageIndex = ref<number | null>(null)
const attachmentMenuOpen = ref(false)
const attachmentMenuRef = ref<HTMLElement | null>(null)
const messagesThreadRef = ref<{ $el: HTMLElement } | null>(null)
const chat = useStarChat()
let recognition: { start: () => void; stop?: () => void; abort?: () => void; lang: string; interimResults: boolean; onresult: ((event: any) => void) | null; onerror: (() => void) | null; onend: (() => void) | null } | null = null

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

async function copyMessage(message: StarChatMessage) {
  const text = message.content.trim()

  if (!text || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return
  }

  await navigator.clipboard.writeText(text)
}

function createStreamingAssistantMessage() {
  return {
    role: 'assistant' as const,
    content: '',
    parts: [{ type: 'text' as const, text: '' }],
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
  const parts = (message.parts ?? []).map((part) => {
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

    if (event.type === 'message') {
      applyStreamMessage(index, event.message)
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

  if ((!text && selectedAttachments.length === 0) || pending.value) {
    return
  }

  if (mode.value === 'design') {
    emit('designRequested', text)
    input.value = ''
    attachmentMenuOpen.value = false
    selectedMediaKinds.value = []
    return
  }

  pending.value = true
  error.value = ''
  localMessages.value.push({
    role: 'user',
    content: text || '发送了一个附件',
    parts: buildAttachmentParts(text || '发送了一个附件', selectedAttachments),
  })
  input.value = ''
  attachments.value = []
  attachmentMenuOpen.value = false
  selectedMediaKinds.value = []

  try {
    const payload = { message: text, attachments: selectedAttachments, intent: selectedIntent }
    const streamMessage = props.sendMessageStream ?? chat.sendMessageStream
    const assistantMessage = createStreamingAssistantMessage()
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
      <StarMagicStage
        ref="messagesThreadRef"
        :messages="localMessages"
        :active-message-index="activeMessageIndex"
        @interact="threadActive = true"
        @activate="activeMessageIndex = $event"
        @copy="copyMessage"
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
    </div>
  </aside>
</template>
