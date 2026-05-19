<script setup lang="ts">
import { withCsrfHeaders } from '../composables/useCsrf'
import type { StarChatMessage } from '../composables/useStarChat'
import type { StarPageDesignSchema } from '../types/design-schema'

const {
  previewSchema,
  loadDesign,
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
const {
  os: agentOs,
  loadOs: loadAgentOs,
  enqueueTask,
  runTask,
  cancelTask,
  approveInboxItem,
  rejectInboxItem,
} = useAgentOs()
const chatMessages = ref<StarChatMessage[]>([])
const designProposalPreview = ref<{ proposalId: string, schema: StarPageDesignSchema } | null>(null)
const activePreviewSchema = computed(() => designProposalPreview.value?.schema ?? previewSchema.value)

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
      headers: withCsrfHeaders(),
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
      <StarChat :initial-messages="chatMessages" />
      <StarPlanetPanel
        :core="agentCore"
        :load-core="loadAgentCore"
        :load-os="loadAgentOs"
        :apply-proposal="applyAgentCoreProposal"
        :approve-inbox-item="approveInboxItem"
        :reject-inbox-item="rejectInboxItem"
        :enqueue-task="enqueueTask"
        :run-task="runTask"
        :cancel-task="cancelTask"
        :preview-design-proposal="previewAgentDesignProposal"
        :run-sleep="runSleep"
        :govern-memory="governMemory"
        :timeline="agentTimeline"
        :timeline-groups="agentTimelineGroups"
        :works="agentWorks"
        :load-timeline="loadTimeline"
        :load-works="loadWorks"
        :update-work-visibility="updateWorkVisibility"
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
