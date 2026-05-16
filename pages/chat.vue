<script setup lang="ts">
import type { StarChatMessage } from '../composables/useStarChat'

const {
  currentSchema,
  previewSchema,
  loadDesign,
  previewDesign,
  commitDesign,
  discardPreview,
} = useKeyDesign()
const { loadMessages } = useStarChat()
const chatMessages = ref<StarChatMessage[]>([])

onMounted(async () => {
  const schema = await loadDesign()

  if (!schema) {
    await navigateTo('/')
    return
  }

  chatMessages.value = await loadMessages()
})
</script>

<template>
  <main class="app-page">
    <ClientOnly>
      <DynamicStarPage v-if="currentSchema" :schema="currentSchema" />
      <StarScene v-else />
      <aside class="star-quota" aria-label="星能量">
        <MiniMaxQuotaPanel />
      </aside>
      <StarChat :initial-messages="chatMessages" @design-requested="previewDesign" />
      <ProfileSettingsSheet />
      <DesignPreviewSheet
        v-if="previewSchema"
        :schema="previewSchema"
        @confirm="commitDesign()"
        @cancel="discardPreview"
      />
    </ClientOnly>
  </main>
</template>
