<script setup lang="ts">
import type { StarChatMessage } from '../composables/useStarChat'

const {
  previewSchema,
  loadDesign,
  previewDesign,
  commitDesign,
  discardPreview,
} = useKeyDesign()
const { loadMessages } = useStarChat()
const { core: agentCore, loadCore: loadAgentCore, applyProposal: applyAgentCoreProposal } = useAgentCore()
const chatMessages = ref<StarChatMessage[]>([])
const profileSettingsOpen = ref(false)
const memoryPlanetOpen = ref(false)

async function openMemoryPlanet() {
  memoryPlanetOpen.value = true
  await loadAgentCore()
}

onMounted(async () => {
  const schema = await loadDesign()

  if (!schema) {
    await navigateTo('/')
    return
  }

  chatMessages.value = await loadMessages()
  await loadAgentCore()
})
</script>

<template>
  <main class="app-page chat-theater">
    <ClientOnly>
      <div class="chat-theater__atmosphere" aria-hidden="true">
        <span class="chat-theater__star chat-theater__star--one" />
        <span class="chat-theater__star chat-theater__star--two" />
        <span class="chat-theater__star chat-theater__star--three" />
        <span class="chat-theater__meteor" />
      </div>
      <StarChat :initial-messages="chatMessages" @design-requested="previewDesign" />
      <StarMemoryMap
        @open-planet="openMemoryPlanet"
        @open-settings="profileSettingsOpen = true"
      />
      <MemoryPlanetPanel
        :core="agentCore"
        :open="memoryPlanetOpen"
        @close="memoryPlanetOpen = false"
      />
      <ProfileSettingsSheet
        :open="profileSettingsOpen"
        hide-trigger
        :load-agent-core="loadAgentCore"
        :apply-agent-core-proposal="applyAgentCoreProposal"
        @close="profileSettingsOpen = false"
      />
      <DesignPreviewSheet
        v-if="previewSchema"
        :schema="previewSchema"
        @confirm="commitDesign()"
        @cancel="discardPreview"
      />
    </ClientOnly>
  </main>
</template>
