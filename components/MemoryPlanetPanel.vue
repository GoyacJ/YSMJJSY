<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MemoryPlanetStage from './MemoryPlanetStage.vue'
import type { AgentCore, AgentTimelineGroup, AgentTimelineItem, AgentWorkItem, MemoryGovernanceAction } from '../composables/useAgentCore'
import { buildMemoryPlanetState } from '../utils/memory-planet'

const props = defineProps<{
  core: AgentCore | null
  open: boolean
  governMemory?: (id: string, action: MemoryGovernanceAction) => Promise<boolean>
  timeline?: AgentTimelineItem[]
  timelineGroups?: AgentTimelineGroup[]
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
const selectedWorkId = ref<string | null>(null)
const workFilter = ref('all')
const activeView = ref<'planet' | 'timeline' | 'works'>('planet')
const state = computed(() => buildMemoryPlanetState(props.core))
const selectedMemory = computed(() => props.core?.memories.find(memory => memory.id === selectedMemoryId.value))
const selectedProposal = computed(() => state.value.proposalLights.find(proposal => proposal.id === selectedProposalId.value))
const filteredWorks = computed(() => {
  const works = props.works ?? []
  return workFilter.value === 'all' ? works : works.filter(work => work.type === workFilter.value)
})
const selectedWork = computed(() => (props.works ?? []).find(work => work.id === selectedWorkId.value))
const latestMemoryGovernanceEvent = computed(() => selectedMemory.value?.governanceEvents?.[0])
const workFilters = [
  { value: 'all', label: '全部', aria: '筛选全部作品' },
  { value: 'image', label: '图片', aria: '筛选图片作品' },
  { value: 'music', label: '音乐', aria: '筛选音乐作品' },
  { value: 'video', label: '视频', aria: '筛选视频作品' },
  { value: 'page_design', label: '页面', aria: '筛选页面作品' },
  { value: 'letter', label: '文字', aria: '筛选文字作品' },
]
const timelineGroupsForDisplay = computed(() => {
  if (props.timelineGroups?.length) {
    return props.timelineGroups
  }

  const items = props.timeline ?? []
  const groups = items.reduce<AgentTimelineGroup[]>((result, item) => {
    const date = item.createdAt.slice(0, 10)
    const group = result.find(existing => existing.date === date)

    if (group) {
      group.items.push(item)
    }
    else {
      result.push({ date, items: [item] })
    }

    return result
  }, [])

  return groups
})
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
      selectedWorkId.value = null
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

function selectWork(id: string) {
  selectedWorkId.value = id
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

function openTimelineItem(item: AgentTimelineItem) {
  if (!item.targetId || !item.targetType) {
    return
  }

  if (item.targetType === 'memory' && props.core?.memories.some(memory => memory.id === item.targetId)) {
    selectedMemoryId.value = item.targetId
    selectedProposalId.value = null
    activeView.value = 'planet'
    return
  }

  if (item.targetType === 'proposal' && state.value.proposalLights.some(proposal => proposal.id === item.targetId)) {
    selectedProposalId.value = item.targetId
    selectedMemoryId.value = null
    activeView.value = 'planet'
    return
  }

  if ((item.targetType === 'work' || item.targetType === 'design') && (props.works ?? []).some(work => work.id === item.targetId)) {
    selectedWorkId.value = item.targetId
    activeView.value = 'works'
  }
}

async function toggleWorkVisibility(work: AgentWorkItem) {
  const nextVisibility = work.visibility === 'public' ? 'private' : 'public'
  await props.updateWorkVisibility?.(work.id, nextVisibility)
}

function getWorkPreviewUrl(work: AgentWorkItem) {
  if (!work.previewUrl) {
    return null
  }

  if (/^(?:data:|https?:|blob:|\/)/.test(work.previewUrl)) {
    return work.previewUrl
  }

  if (work.type === 'image') {
    return `data:image/png;base64,${work.previewUrl}`
  }

  if (work.type === 'video') {
    return `data:video/mp4;base64,${work.previewUrl}`
  }

  return `data:audio/mpeg;base64,${work.previewUrl}`
}

function getWorkSchemaTitle(work: AgentWorkItem) {
  const payload = work.payload
  return payload && typeof payload.title === 'string' ? payload.title : ''
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
      <button type="button" class="dialog-close-button memory-planet-panel__close" aria-label="关闭记忆星球" @click="$emit('close')">
        ×
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
    </div>

    <section v-else-if="activeView === 'timeline'" class="memory-planet-panel__list memory-planet-panel__timeline">
      <section v-for="group in timelineGroupsForDisplay" :key="group.date" class="memory-planet-panel__timeline-group">
        <p>{{ group.date }}</p>
        <article v-for="item in group.items" :key="item.id" :data-importance="item.importance ?? 'normal'">
          <button type="button" :aria-label="`打开时间线事件：${item.title}`" @click="openTimelineItem(item)">
            <span>{{ item.type }}</span>
            <strong>{{ item.title }}</strong>
            <span>{{ item.summary }}</span>
            <span v-if="item.importance === 'high'">高信号</span>
          </button>
        </article>
      </section>
      <p v-if="!timelineGroupsForDisplay.length">还没有时间线</p>
    </section>

    <section v-else class="memory-planet-panel__list">
      <div class="memory-planet-panel__filters" aria-label="作品筛选">
        <button
          v-for="filter in workFilters"
          :key="filter.value"
          type="button"
          :aria-label="filter.aria"
          :aria-pressed="workFilter === filter.value"
          @click="workFilter = filter.value"
        >
          {{ filter.label }}
        </button>
      </div>
      <article v-for="work in filteredWorks" :key="work.id">
        <button type="button" :aria-label="`查看作品：${work.title}`" @click="selectWork(work.id)">
          <img
            v-if="work.type === 'image' && getWorkPreviewUrl(work)"
            class="memory-planet-panel__work-preview"
            :src="getWorkPreviewUrl(work)!"
            :alt="work.title"
          >
          <strong>{{ work.title }}</strong>
          <span>{{ work.summary }}</span>
        </button>
        <button type="button" :aria-label="work.visibility === 'public' ? '设为私密作品' : '公开作品'" @click="toggleWorkVisibility(work)">
          {{ work.visibility === 'public' ? '设为私密' : '公开' }}
        </button>
      </article>
      <p v-if="!filteredWorks.length">还没有作品</p>
    </section>

    <section v-if="activeView === 'planet'" class="memory-planet-panel__detail">
      <template v-if="selectedMemory">
        <p>记忆</p>
        <strong>{{ selectedMemory.content }}</strong>
        <span>{{ selectedMemory.type }}</span>
        <span>重要性 {{ selectedMemory.importance.toFixed(2) }} · 置信 {{ selectedMemory.confidence.toFixed(2) }}</span>
        <span>状态 {{ selectedMemory.status ?? 'active' }}</span>
        <span v-if="selectedMemory.sourceConversationId">来源 {{ selectedMemory.sourceConversationId }}</span>
        <span v-if="selectedMemory.sourceAttachmentId">附件 {{ selectedMemory.sourceAttachmentId }}</span>
        <span v-if="selectedMemory.sourceExcerpt">{{ selectedMemory.sourceExcerpt }}</span>
        <span v-if="latestMemoryGovernanceEvent">
          最近治理动作 {{ latestMemoryGovernanceEvent.action }} · {{ latestMemoryGovernanceEvent.reason }}
        </span>
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

    <section v-if="activeView === 'works' && selectedWork" class="memory-planet-panel__detail">
      <p>作品</p>
      <strong>{{ selectedWork.title }}</strong>
      <span>{{ selectedWork.summary }}</span>
      <span>{{ selectedWork.type }} · {{ selectedWork.visibility }}</span>
      <span v-if="selectedWork.sourceConversationId">来源 {{ selectedWork.sourceConversationId }}</span>
      <span v-if="selectedWork.sourceDesignVersion">设计版本 {{ selectedWork.sourceDesignVersion }}</span>
      <img v-if="selectedWork.type === 'image' && getWorkPreviewUrl(selectedWork)" :src="getWorkPreviewUrl(selectedWork)!" :alt="selectedWork.title">
      <audio v-else-if="selectedWork.type === 'music' && getWorkPreviewUrl(selectedWork)" :src="getWorkPreviewUrl(selectedWork)!" controls />
      <video v-else-if="selectedWork.type === 'video' && getWorkPreviewUrl(selectedWork)" :src="getWorkPreviewUrl(selectedWork)!" controls />
      <span v-else-if="selectedWork.type === 'page_design' && getWorkSchemaTitle(selectedWork)">
        {{ getWorkSchemaTitle(selectedWork) }}
      </span>
    </section>
  </aside>
  </div>
</template>
