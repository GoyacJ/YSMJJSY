<script setup lang="ts">
import { computed } from 'vue'
import StarGlyphText from './StarGlyphText.vue'
import StarMediaCard from './StarMediaCard.vue'
import type { StarChatMessage, StarChatPart } from '../composables/useStarChat'

const props = defineProps<{
  message: StarChatMessage
  active: boolean
}>()

const emit = defineEmits<{
  copy: [message: StarChatMessage]
  activate: []
}>()

const messageClass = computed(() => ({
  'star-chat-message--spell': props.message.role === 'user',
  'star-chat-message--magic': props.message.role === 'assistant',
}))

function isMediaPart(part: StarChatPart) {
  return ['audio', 'image', 'music', 'video'].includes(part.type)
}
</script>

<template>
  <article
    class="star-chat-message"
    :class="messageClass"
    :data-role="message.role"
    :data-active="String(active)"
    @click="emit('activate')"
  >
    <span v-if="message.role === 'assistant'" class="star-chat-message__orb" aria-hidden="true" />

    <img
      v-if="message.imageDataUrl"
      class="star-chat-message__legacy-image"
      :src="message.imageDataUrl"
      alt=""
    >
    <a
      v-if="message.imageDataUrl"
      class="star-chat-message__download"
      :href="message.imageDataUrl"
      download="star-attachment.png"
      aria-label="下载图片"
      @click.stop
    >
      下载
    </a>

    <template v-if="message.parts?.length">
      <template v-for="(part, partIndex) in message.parts" :key="partIndex">
        <StarGlyphText
          v-if="part.type === 'text'"
          class="star-chat-message__text"
          :text="part.text"
          :role="message.role"
        />
        <span v-else-if="part.type === 'status'" class="star-chat-message__status">{{ part.text }}</span>
        <StarMediaCard v-else-if="isMediaPart(part)" :part="part" />
      </template>
    </template>
    <StarGlyphText v-else class="star-chat-message__text" :text="message.content" :role="message.role" />

    <button
      type="button"
      class="star-chat-message__copy"
      aria-label="复制消息"
      @click.stop="emit('copy', props.message)"
    >
      复制
    </button>
  </article>
</template>
