<script setup lang="ts">
import StarChatThread from './StarChatThread.vue'
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
  <section
    class="star-magic-stage"
    aria-label="星信舞台"
    @click="emit('interact')"
    @touchstart.passive="emit('interact')"
  >
    <div class="star-magic-stage__veil" aria-hidden="true" />
    <div class="star-magic-stage__constellation" aria-hidden="true">
      <span v-for="index in 18" :key="index" />
    </div>
    <StarChatThread
      :messages="messages"
      :active-message-index="activeMessageIndex"
      @copy="emit('copy', $event)"
      @activate="emit('activate', $event)"
      @interact="emit('interact')"
    />
  </section>
</template>
