<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MemoryPlanetStage from './MemoryPlanetStage.vue'
import type { AgentCore, AgentCoreProposalAction, AgentTimelineItem, AgentWorkItem, MemoryGovernanceAction } from '../composables/useAgentCore'
import { buildMemoryPlanetState } from '../utils/memory-planet'

const props = defineProps<{
  core: AgentCore | null
  open: boolean
  governMemory?: (id: string, action: MemoryGovernanceAction) => Promise<boolean>
  loadCore?: () => Promise<AgentCore | null>
  applyProposal?: (id: string, action: AgentCoreProposalAction) => Promise<boolean>
  previewDesignProposal?: (id: string) => Promise<boolean>
  runSleep?: () => Promise<boolean>
  timeline?: AgentTimelineItem[]
  works?: AgentWorkItem[]
  loadTimeline?: () => Promise<AgentTimelineItem[]>
  loadWorks?: () => Promise<AgentWorkItem[]>
  updateWorkVisibility?: (id: string, visibility: AgentWorkItem['visibility']) => Promise<boolean>
}>()

defineEmits<{
  close: []
}>()

const selectedMemoryId = ref<string | null>(null)
const selectedProposalId = ref<string | null>(null)
const activeView = ref<'planet' | 'timeline' | 'works'>('planet')
const state = computed(() => buildMemoryPlanetState(props.core))
const selectedMemory = computed(() => state.value.memoryStars.find(memory => memory.id === selectedMemoryId.value))
const selectedProposal = computed(() => state.value.proposalLights.find(proposal => proposal.id === selectedProposalId.value))
const hasPlanetContent = computed(() => {
  return state.value.memoryStars.length > 0
    || state.value.reflectionNebulas.length > 0
    || state.value.proposalLights.length > 0
    || state.value.orbitRings.length > 0
})

watch(
  () => props.open,
  (open) => {
    if (!open) {
      selectedMemoryId.value = null
      selectedProposalId.value = null
    }
  },
)

function selectMemory(id: string) {
  selectedMemoryId.value = id
  selectedProposalId.value = null
}

function selectProposal(id: string) {
  selectedProposalId.value = id
  selectedMemoryId.value = null
}

async function applyMemoryAction(action: MemoryGovernanceAction) {
  if (!selectedMemory.value || !props.governMemory) {
    return
  }

  await props.governMemory(selectedMemory.value.id, action)
}

async function switchView(view: 'planet' | 'timeline' | 'works') {
  activeView.value = view

  if (view === 'timeline') {
    await props.loadTimeline?.()
  }

  if (view === 'works') {
    await props.loadWorks?.()
  }
}

async function toggleWorkVisibility(work: AgentWorkItem) {
  const nextVisibility = work.visibility === 'public' ? 'private' : 'public'
  await props.updateWorkVisibility?.(work.id, nextVisibility)
}
</script>

<template>
  <div v-if="open" class="memory-planet-panel__backdrop" @click.self="$emit('close')">
  <aside class="memory-planet-panel" role="dialog" aria-label="记忆星球">
    <header>
      <div>
        <p>记忆星球</p>
        <span>记忆、反思和进化轨道</span>
      </div>
      <button type="button" class="memory-planet-panel__close" aria-label="关闭记忆星球" @click="$emit('close')">
        关闭
      </button>
    </header>

    <nav class="memory-planet-panel__tabs" aria-label="记忆星球视图">
      <button type="button" aria-label="查看记忆星球" :aria-pressed="activeView === 'planet'" @click="switchView('planet')">
        星球
      </button>
      <button type="button" aria-label="查看星球时间线" :aria-pressed="activeView === 'timeline'" @click="switchView('timeline')">
        时间线
      </button>
      <button type="button" aria-label="查看智能体作品" :aria-pressed="activeView === 'works'" @click="switchView('works')">
        作品
      </button>
    </nav>

    <div v-if="activeView === 'planet'" class="memory-planet-panel__layout">
      <MemoryPlanetStage
        :state="state"
        @select-memory="selectMemory"
        @select-proposal="selectProposal"
      />

      <section class="memory-planet-panel__ai" aria-label="星AI">
        <AgentCorePanel
          embedded
          :load-core="loadCore"
          :apply-proposal="applyProposal"
          :preview-design-proposal="previewDesignProposal"
          :run-sleep="runSleep"
        />
      </section>
    </div>

    <section v-else-if="activeView === 'timeline'" class="memory-planet-panel__list">
      <article v-for="item in timeline ?? []" :key="item.id">
        <strong>{{ item.title }}</strong>
        <span>{{ item.summary }}</span>
      </article>
      <p v-if="!(timeline ?? []).length">还没有时间线</p>
    </section>

    <section v-else class="memory-planet-panel__list">
      <article v-for="work in works ?? []" :key="work.id">
        <strong>{{ work.title }}</strong>
        <span>{{ work.summary }}</span>
        <button type="button" :aria-label="work.visibility === 'public' ? '设为私密作品' : '公开作品'" @click="toggleWorkVisibility(work)">
          {{ work.visibility === 'public' ? '设为私密' : '公开' }}
        </button>
      </article>
      <p v-if="!(works ?? []).length">还没有作品</p>
    </section>

    <section v-if="activeView === 'planet'" class="memory-planet-panel__detail">
      <template v-if="selectedMemory">
        <p>记忆</p>
        <strong>{{ selectedMemory.content }}</strong>
        <span>{{ selectedMemory.type }}</span>
        <span>重要性 {{ selectedMemory.importance.toFixed(2) }} · 置信 {{ selectedMemory.confidence.toFixed(2) }}</span>
        <div class="memory-planet-panel__actions">
          <button type="button" aria-label="确认记忆" @click="applyMemoryAction('confirm')">
            确认
          </button>
          <button type="button" aria-label="降低记忆权重" @click="applyMemoryAction('downgrade')">
            降权
          </button>
          <button type="button" aria-label="归档记忆" @click="applyMemoryAction('archive')">
            归档
          </button>
          <button type="button" aria-label="拒绝记忆" @click="applyMemoryAction('reject')">
            拒绝
          </button>
        </div>
      </template>
      <template v-else-if="selectedProposal">
        <p>待确认进化</p>
        <strong>{{ selectedProposal.title }}</strong>
        <span>{{ selectedProposal.summary }}</span>
      </template>
      <template v-else-if="!hasPlanetContent">
        <p>还没有形成星球</p>
        <span>对话后会出现记忆、反思和进化轨道。</span>
      </template>
      <template v-else>
        <p>星球正在记录</p>
        <span>点亮一颗记忆星查看内容。</span>
      </template>
    </section>
  </aside>
  </div>
</template>
