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
const {
  core: agentCore,
  timeline: agentTimeline,
  works: agentWorks,
  loadCore: loadAgentCore,
  applyProposal: applyAgentCoreProposal,
  runSleep,
  governMemory,
  loadTimeline,
  loadWorks,
  updateWorkVisibility,
} = useAgentCore()
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
      <AgentCorePanel
        :load-core="loadAgentCore"
        :apply-proposal="applyAgentCoreProposal"
        :run-sleep="runSleep"
      />
      <MemoryPlanetPanel
        :core="agentCore"
        :open="memoryPlanetOpen"
        :govern-memory="governMemory"
        :load-core="loadAgentCore"
        :apply-proposal="applyAgentCoreProposal"
        :run-sleep="runSleep"
        :timeline="agentTimeline"
        :works="agentWorks"
        :load-timeline="loadTimeline"
        :load-works="loadWorks"
        :update-work-visibility="updateWorkVisibility"
        @close="memoryPlanetOpen = false"
      />
      <ProfileSettingsSheet
        :open="profileSettingsOpen"
        hide-trigger
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
