<script setup lang="ts">
import StarChatMessageView from './StarChatMessage.vue'
import type { StarChatMessage } from '../composables/useStarChat'

defineProps<{
  messages: StarChatMessage[]
  activeMessageIndex: number | null
}>()

const emit = defineEmits<{
  copy: [message: StarChatMessage]
  activate: [index: number]
  interact: []
}>()
</script>

<template>
  <div
    v-if="messages.length > 0"
    class="star-chat__thread star-chat__thread--transparent star-chat__messages"
    aria-live="polite"
    @click="emit('interact')"
    @touchstart.passive="emit('interact')"
  >
    <StarChatMessageView
      v-for="(message, index) in messages"
      :key="`${message.role}-${index}`"
      :message="message"
      :active="activeMessageIndex === index"
      @activate="emit('activate', index)"
      @copy="emit('copy', $event)"
    />
  </div>
</template>
