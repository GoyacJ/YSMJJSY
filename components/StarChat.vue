<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useStarChat, type StarChatMessage, type StarChatReply } from '../composables/useStarChat'

const props = defineProps<{
  sendMessage?: (message: string, imageDataUrl?: string) => Promise<StarChatReply>
}>()

const input = ref('')
const pending = ref(false)
const error = ref('')
const localMessages = ref<StarChatMessage[]>([])
const imageDataUrl = ref('')
const imageName = ref('')
const listening = ref(false)
const chat = useStarChat()
let recognition: { start: () => void; stop?: () => void; abort?: () => void; lang: string; interimResults: boolean; onresult: ((event: any) => void) | null; onerror: (() => void) | null; onend: (() => void) | null } | null = null

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Image read failed'))
    reader.readAsDataURL(file)
  })
}

async function handleImageChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]

  if (!file) {
    return
  }

  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2_000_000) {
    error.value = '图片需要是 2MB 内的 PNG、JPG 或 WebP。'
    return
  }

  try {
    imageDataUrl.value = await readFileAsDataUrl(file)
    imageName.value = file.name
    error.value = ''
  }
  catch {
    error.value = '这张图片没有读到。'
  }
}

function removeImage() {
  imageDataUrl.value = ''
  imageName.value = ''
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
  const image = imageDataUrl.value

  if ((!text && !image) || pending.value) {
    return
  }

  pending.value = true
  error.value = ''
  localMessages.value.push({ role: 'user', content: text || '发送了一张图片', imageDataUrl: image || undefined })
  input.value = ''
  removeImage()

  try {
    const result = props.sendMessage
      ? await props.sendMessage(text, image || undefined)
      : await chat.sendMessage(text, image || undefined)

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
  <aside class="star-chat" aria-label="星信">
    <div class="star-chat__note">
      <header class="star-chat__header">
        <p>星信</p>
        <span>这封信里的星光</span>
      </header>

      <div class="star-chat__thread star-chat__messages" aria-live="polite">
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

      <form class="star-chat__composer" @submit.prevent="submit">
        <label class="sr-only" for="star-chat-input">和星信说话</label>
        <textarea
          id="star-chat-input"
          v-model="input"
          rows="2"
          placeholder="写一张星信"
        />
        <div class="star-chat__tools">
          <button
            type="button"
            class="star-chat__icon-button"
            :disabled="pending || listening"
            aria-label="语音输入"
            @click="startVoiceInput"
          >
            {{ listening ? '听' : '声' }}
          </button>
          <label class="star-chat__image-button star-chat__icon-button" aria-label="添加图片">
            图
            <input type="file" accept="image/png,image/jpeg,image/webp" @change="handleImageChange">
          </label>
          <button
            class="star-chat__icon-button star-chat__icon-button--send"
            type="submit"
            :disabled="pending"
            aria-label="发送"
          >
            {{ pending ? '等' : '寄' }}
          </button>
        </div>
      </form>

      <div v-if="imageDataUrl" class="star-chat__image-preview">
        <img :src="imageDataUrl" alt="">
        <span>{{ imageName }}</span>
        <button type="button" @click="removeImage">
          移除
        </button>
      </div>

      <p v-if="error" class="star-chat__error" role="alert">
        {{ error }}
      </p>

      <MediaCreationPanel :source-text="localMessages.at(-1)?.content || '这封信里的星光'" />
    </div>
  </aside>
</template>
