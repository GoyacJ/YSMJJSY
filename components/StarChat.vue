<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import {
  useStarChat,
  type AttachmentKind,
  type StarChatAttachment,
  type StarChatMessage,
  type StarChatReply,
  type StarChatSendPayload,
} from '../composables/useStarChat'

const props = defineProps<{
  sendMessage?: (payload: StarChatSendPayload) => Promise<StarChatReply>
}>()

const emit = defineEmits<{
  designRequested: [instruction: string]
}>()

const input = ref('')
const pending = ref(false)
const error = ref('')
const localMessages = ref<StarChatMessage[]>([])
const attachments = ref<StarChatAttachment[]>([])
const listening = ref(false)
const mode = ref<'chat' | 'design'>('chat')
const threadActive = ref(false)
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

async function handleAttachmentChange(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files ?? []).slice(0, 3)

  if (files.length === 0) {
    return
  }

  try {
    const nextAttachments: StarChatAttachment[] = []

    for (const file of files) {
      const kind = getAttachmentKind(file)

      if (!kind) {
        error.value = '只能添加图片、音频或视频。'
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
    error.value = ''
  }
  catch {
    error.value = '附件没有读到。'
  }
}

function removeAttachment(index: number) {
  attachments.value.splice(index, 1)
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

async function submit() {
  const text = input.value.trim()
  const selectedAttachments = [...attachments.value]

  if ((!text && selectedAttachments.length === 0) || pending.value) {
    return
  }

  if (mode.value === 'design') {
    emit('designRequested', text)
    input.value = ''
    return
  }

  pending.value = true
  error.value = ''
  localMessages.value.push({
    role: 'user',
    content: text || '发送了一个附件',
    imageDataUrl: selectedAttachments.find(attachment => attachment.kind === 'image')?.dataUrl,
  })
  input.value = ''
  attachments.value = []

  try {
    const payload = { message: text, attachments: selectedAttachments }
    const result = props.sendMessage
      ? await props.sendMessage(payload)
      : await chat.sendMessage(payload)

    if (result.reply) {
      localMessages.value.push({ role: 'assistant', content: result.reply })
    }
  }
  catch {
    error.value = '星信刚刚走神了，等一下再试。'
  }
  finally {
    pending.value = false
  }
}

onBeforeUnmount(() => {
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
      <header class="star-chat__header">
        <p>星信</p>
        <span>这封信里的星光</span>
      </header>

      <div
        class="star-chat__thread star-chat__messages"
        aria-live="polite"
        @click="threadActive = true"
        @touchstart.passive="threadActive = true"
      >
        <p v-if="localMessages.length === 0" class="star-chat__empty">
          你可以问这封信里的任何一句话。
        </p>
        <article
          v-for="(message, index) in localMessages"
          :key="`${message.role}-${index}`"
          :data-role="message.role"
        >
          <img
            v-if="message.imageDataUrl"
            class="star-chat__message-image"
            :src="message.imageDataUrl"
            alt=""
          >
          <span>{{ message.content }}</span>
        </article>
      </div>

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

      <MediaCreationPanel :source-text="localMessages.at(-1)?.content || '这封信里的星光'" />

      <form class="star-chat__composer star-chat__dock" @submit.prevent="submit">
        <label class="sr-only" for="star-chat-input">和星信说话</label>
        <textarea
          id="star-chat-input"
          v-model="input"
          rows="2"
          :placeholder="mode === 'design' ? '请输入你的创意想法' : '要求后续变更'"
          @focus="threadActive = true"
        />
        <div class="star-chat__dock-bar">
          <div class="star-chat__tools">
            <label class="star-chat__attachment-button star-chat__icon-button" aria-label="添加附件">
              +
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/mp3,audio/mp4,audio/m4a,audio/wav,audio/webm,video/mp4,video/webm,video/quicktime"
                @change="handleAttachmentChange"
              >
            </label>
            <button
              type="button"
              class="star-chat__icon-button"
              :disabled="pending || listening"
              aria-label="语音输入"
              @click="startVoiceInput"
            >
              {{ listening ? '听' : '声' }}
            </button>
            <button
              type="button"
              class="star-chat__permission"
              aria-label="完全访问权限"
            >
              完全访问权限
            </button>
            <button
              type="button"
              class="star-chat__icon-button"
              :data-active="mode === 'design'"
              aria-label="设计模式"
              @click="mode = mode === 'design' ? 'chat' : 'design'"
            >
              设
            </button>
          </div>
          <div class="star-chat__tools star-chat__tools--send">
            <button
              class="star-chat__icon-button star-chat__icon-button--send"
              type="submit"
              :disabled="pending"
              aria-label="发送"
            >
              {{ pending ? '等' : '寄' }}
            </button>
          </div>
        </div>
      </form>
    </div>
  </aside>
</template>
