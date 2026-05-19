<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AgentCore, AgentCoreProposalAction, AgentTimelineGroup, AgentTimelineItem, AgentWorkItem, MemoryGovernanceAction } from '../composables/useAgentCore'
import type { AgentOsState, AgentOsTaskItem, AgentTaskCreateInput } from '../composables/useAgentOs'

type StarPlanetTab = 'memory' | 'works' | 'boundaries' | 'records'

const props = defineProps<{
  core: AgentCore | null
  timeline?: AgentTimelineItem[]
  timelineGroups?: AgentTimelineGroup[]
  works?: AgentWorkItem[]
  loadCore?: () => Promise<AgentCore | null>
  loadTimeline?: () => Promise<AgentTimelineItem[]>
  loadWorks?: () => Promise<AgentWorkItem[]>
  governMemory?: (id: string, action: MemoryGovernanceAction) => Promise<boolean>
  updateWorkVisibility?: (id: string, visibility: AgentWorkItem['visibility']) => Promise<boolean>
  os?: AgentOsState | null
  loadOs?: () => Promise<AgentOsState | null>
  applyProposal?: (id: string, action: AgentCoreProposalAction) => Promise<boolean>
  approveInboxItem?: (id: string) => Promise<boolean>
  rejectInboxItem?: (id: string) => Promise<boolean>
  enqueueTask?: (input: AgentTaskCreateInput) => Promise<AgentOsTaskItem | null>
  runTask?: (id: string) => Promise<boolean>
  cancelTask?: (id: string) => Promise<boolean>
  previewDesignProposal?: (id: string) => Promise<boolean>
  runSleep?: () => Promise<boolean>
}>()

const open = ref(false)
const activeTab = ref<StarPlanetTab>('memory')
const pending = ref(false)
const loadedOs = ref<AgentOsState | null>(props.os ?? null)
const recordsOs = computed(() => loadedOs.value ?? props.os ?? null)
const tabs: Array<{ value: StarPlanetTab, label: string, aria: string }> = [
  { value: 'memory', label: '记忆', aria: '查看记忆' },
  { value: 'works', label: '作品', aria: '查看作品' },
  { value: 'boundaries', label: '边界', aria: '查看边界' },
  { value: 'records', label: '记录', aria: '查看记录' },
]

async function openPanel() {
  open.value = true
  await loadForTab(activeTab.value)
}

async function switchTab(tab: StarPlanetTab) {
  activeTab.value = tab
  await loadForTab(tab)
}

async function loadForTab(tab: StarPlanetTab) {
  pending.value = true

  try {
    if (tab === 'memory') {
      await props.loadCore?.()
    }
    else if (tab === 'works') {
      await Promise.all([
        props.loadCore?.(),
        props.loadWorks?.(),
      ])
    }
    else if (tab === 'records') {
      loadedOs.value = await props.loadOs?.() ?? loadedOs.value
    }
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <aside class="star-planet-panel">
    <button
      type="button"
      class="star-planet-panel__trigger"
      :aria-expanded="open"
      @click="openPanel"
    >
      星球
    </button>

    <div v-if="open" class="star-planet-panel__backdrop" @click.self="open = false">
      <section class="star-planet-panel__sheet" role="dialog" aria-label="星球">
        <header>
          <div>
            <p>星球</p>
            <span>记忆、作品、边界和记录</span>
          </div>
          <button type="button" class="dialog-close-button star-planet-panel__close" aria-label="关闭星球" @click="open = false">
            ×
          </button>
        </header>

        <nav class="star-planet-panel__tabs" aria-label="星球视图">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            :aria-label="tab.aria"
            :aria-pressed="activeTab === tab.value"
            @click="switchTab(tab.value)"
          >
            {{ tab.label }}
          </button>
        </nav>

        <p v-if="pending" class="star-planet-panel__muted">
          正在读取
        </p>

        <MemoryPlanetPanel
          v-if="activeTab === 'memory'"
          :core="core"
          :open="true"
          embedded
          memory-only
          initial-view="planet"
          :govern-memory="governMemory"
          :timeline="timeline"
          :timeline-groups="timelineGroups"
          :load-timeline="loadTimeline"
          @close="open = false"
        />

        <StarWorksPanel
          v-else-if="activeTab === 'works'"
          :works="works"
          :update-work-visibility="updateWorkVisibility"
        />

        <ProfileSettingsSheet
          v-else-if="activeTab === 'boundaries'"
          :open="true"
          hide-trigger
          embedded
        />

        <StarRecordsPanel
          v-else
          :os="recordsOs"
          :load-os="loadOs"
          :approve-inbox-item="approveInboxItem"
          :reject-inbox-item="rejectInboxItem"
          :preview-design-proposal="previewDesignProposal"
        />
      </section>
    </div>
  </aside>
</template>
