<script setup lang="ts">
import type { StarChatMessage } from '../composables/useStarChat'
import type { StarPageDesignSchema } from '../types/design-schema'

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
  timelineGroups: agentTimelineGroups,
  works: agentWorks,
  loadCore: loadAgentCore,
  applyProposal: applyAgentCoreProposal,
  previewDesignProposal,
  runSleep,
  governMemory,
  loadTimeline,
  loadWorks,
  updateWorkVisibility,
} = useAgentCore()
const chatMessages = ref<StarChatMessage[]>([])
const profileSettingsOpen = ref(false)
const memoryPlanetOpen = ref(false)
const designProposalPreview = ref<{ proposalId: string, schema: StarPageDesignSchema } | null>(null)
const activePreviewSchema = computed(() => designProposalPreview.value?.schema ?? previewSchema.value)

async function openMemoryPlanet() {
  memoryPlanetOpen.value = true
  await loadAgentCore()
}

async function previewAgentDesignProposal(id: string) {
  const result = await previewDesignProposal(id)

  if (!result) {
    return false
  }

  designProposalPreview.value = {
    proposalId: id,
    schema: result.schema,
  }
  return true
}

async function confirmDesignPreview() {
  if (designProposalPreview.value) {
    const preview = designProposalPreview.value

    await $fetch('/api/design/commit', {
      method: 'POST',
      body: {
        schema: preview.schema,
        proposalId: preview.proposalId,
      },
    })
    designProposalPreview.value = null
    await loadDesign()
    await loadAgentCore()
    return
  }

  await commitDesign()
}

function discardActivePreview() {
  if (designProposalPreview.value) {
    designProposalPreview.value = null
    return
  }

  discardPreview()
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
        :preview-design-proposal="previewAgentDesignProposal"
        :run-sleep="runSleep"
      />
      <MemoryPlanetPanel
        :core="agentCore"
        :open="memoryPlanetOpen"
        :govern-memory="governMemory"
        :load-core="loadAgentCore"
        :apply-proposal="applyAgentCoreProposal"
        :preview-design-proposal="previewAgentDesignProposal"
        :run-sleep="runSleep"
        :timeline="agentTimeline"
        :timeline-groups="agentTimelineGroups"
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
        v-if="activePreviewSchema"
        :schema="activePreviewSchema"
        @confirm="confirmDesignPreview"
        @cancel="discardActivePreview"
      />
    </ClientOnly>
  </main>
</template>
