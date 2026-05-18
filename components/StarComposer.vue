<script setup lang="ts">
import type { AttachmentKind, StarChatIntent } from '../composables/useStarChat'

type MediaIntent = Exclude<StarChatIntent, 'auto' | 'chat'>

defineProps<{
  input: string
  pending: boolean
  listening: boolean
  selectedMediaKinds: MediaIntent[]
  attachmentMenuOpen: boolean
}>()

const emit = defineEmits<{
  'update:input': [value: string]
  submit: []
  focus: []
  'toggle-attachments': []
  'attachment-change': [event: Event, kind: AttachmentKind]
  'start-voice': []
  'toggle-media-kind': [kind: MediaIntent]
}>()

const mediaActions: Array<{ kind: MediaIntent, label: string, icon: string }> = [
  { kind: 'audio', label: '听一听', icon: 'M12 3v18M8 7v10M4 10v4M16 7v10M20 10v4' },
  { kind: 'image', label: '画一张', icon: 'M4 5h16v14H4zM8 14l2.5-3 2 2.5L15 10l5 6M8 9h.01' },
  { kind: 'video', label: '做一段', icon: 'M4 6h11v12H4zM15 10l5-3v10l-5-3z' },
  { kind: 'music', label: '写一首', icon: 'M9 18V5l10-2v13M9 9l10-2M7 18a2 2 0 1 0 4 0 2 2 0 0 0-4 0M17 16a2 2 0 1 0 4 0 2 2 0 0 0-4 0' },
]

function handleInputEnter(event: KeyboardEvent) {
  if (event.shiftKey || event.isComposing) {
    return
  }

  event.preventDefault()
  emit('submit')
}
</script>

<template>
  <form class="star-chat__composer star-chat__dock" @submit.prevent="emit('submit')">
    <label class="sr-only" for="star-chat-input">和星信说话</label>
    <div class="star-chat__tools">
      <div class="star-chat__attachment-menu">
        <button
          type="button"
          class="star-chat__attachment-button star-chat__icon-button"
          :aria-expanded="attachmentMenuOpen"
          aria-controls="star-chat-attachment-options"
          aria-label="添加附件"
          @click="emit('toggle-attachments')"
        >
          +
        </button>
        <div
          v-if="attachmentMenuOpen"
          id="star-chat-attachment-options"
          class="star-chat__attachment-popover"
          role="menu"
        >
          <label role="menuitem" aria-label="上传图片">
            <span>上传图片</span>
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              @change="emit('attachment-change', $event, 'image')"
            >
          </label>
          <label role="menuitem" aria-label="上传音频">
            <span>上传音频</span>
            <input
              type="file"
              multiple
              accept="audio/mpeg,audio/mp3,audio/mp4,audio/m4a,audio/wav,audio/webm"
              @change="emit('attachment-change', $event, 'audio')"
            >
          </label>
          <label role="menuitem" aria-label="上传视频">
            <span>上传视频</span>
            <input
              type="file"
              multiple
              accept="video/mp4,video/webm,video/quicktime"
              @change="emit('attachment-change', $event, 'video')"
            >
          </label>
          <div class="star-chat__mobile-actions" aria-label="更多操作">
            <button
              type="button"
              class="star-chat__icon-button"
              :disabled="listening"
              aria-label="语音输入"
              @click="emit('start-voice')"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v10" />
                <path d="M8 11a4 4 0 0 0 8 0V7a4 4 0 0 0-8 0v4Z" />
                <path d="M5 11a7 7 0 0 0 14 0" />
                <path d="M12 18v3" />
              </svg>
              <span>{{ listening ? '正在听' : '语音输入' }}</span>
            </button>
            <button
              v-for="action in mediaActions"
              :key="`mobile-${action.kind}`"
              type="button"
              class="star-chat__icon-button"
              :data-active="selectedMediaKinds.includes(action.kind)"
              :aria-label="action.label"
              @click="emit('toggle-media-kind', action.kind)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path :d="action.icon" />
              </svg>
              <span>{{ action.label }}</span>
            </button>
          </div>
        </div>
      </div>
      <div class="star-chat__quick-tools">
        <button
          type="button"
          class="star-chat__icon-button"
          :disabled="listening"
          aria-label="语音输入"
          @click="emit('start-voice')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v10" />
            <path d="M8 11a4 4 0 0 0 8 0V7a4 4 0 0 0-8 0v4Z" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <path d="M12 18v3" />
          </svg>
          <span class="sr-only">{{ listening ? '正在听' : '语音输入' }}</span>
        </button>
        <button
          v-for="action in mediaActions"
          :key="action.kind"
          type="button"
          class="star-chat__icon-button"
          :data-active="selectedMediaKinds.includes(action.kind)"
          :aria-label="action.label"
          @click="emit('toggle-media-kind', action.kind)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path :d="action.icon" />
          </svg>
          <span class="sr-only">{{ action.label }}</span>
        </button>
      </div>
    </div>
    <textarea
      id="star-chat-input"
      :value="input"
      rows="1"
      placeholder="把想说的话交给这片星空"
      @input="emit('update:input', ($event.target as HTMLTextAreaElement).value)"
      @focus="emit('focus')"
      @keydown.enter="handleInputEnter"
    />
    <button
      class="star-chat__icon-button star-chat__icon-button--send"
      type="submit"
      aria-label="发送"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h13" />
        <path d="m13 6 6 6-6 6" />
      </svg>
      <span class="sr-only">{{ pending ? '加入发送队列' : '发送' }}</span>
    </button>
  </form>
</template>
