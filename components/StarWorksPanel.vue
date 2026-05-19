<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AgentWorkItem } from '../composables/useAgentCore'

const props = defineProps<{
  works?: AgentWorkItem[]
  updateWorkVisibility?: (id: string, visibility: AgentWorkItem['visibility']) => Promise<boolean>
}>()

const selectedWorkId = ref<string | null>(null)
const workFilter = ref('all')

const workFilters = [
  { value: 'all', label: '全部', aria: '筛选全部作品' },
  { value: 'image', label: '图片', aria: '筛选图片作品' },
  { value: 'music', label: '音乐', aria: '筛选音乐作品' },
  { value: 'video', label: '视频', aria: '筛选视频作品' },
  { value: 'page_design', label: '页面', aria: '筛选页面作品' },
  { value: 'letter', label: '文字', aria: '筛选文字作品' },
]
const filteredWorks = computed(() => {
  const works = props.works ?? []
  return workFilter.value === 'all' ? works : works.filter(work => work.type === workFilter.value)
})
const selectedWork = computed(() => (props.works ?? []).find(work => work.id === selectedWorkId.value))

function selectWork(id: string) {
  selectedWorkId.value = id
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

function getWorkVisibilityLabel(visibility: AgentWorkItem['visibility']) {
  return visibility === 'public' ? '已公开' : '私密'
}

function getWorkDisclosureLabel(work: AgentWorkItem) {
  const disclosure = work.payload?.disclosure

  if (!disclosure || typeof disclosure !== 'object' || Array.isArray(disclosure)) {
    return ''
  }

  const explicitLabel = (disclosure as { explicitLabel?: unknown }).explicitLabel
  return typeof explicitLabel === 'string' && explicitLabel.trim() ? explicitLabel : ''
}
</script>

<template>
  <section class="star-works-panel" aria-label="作品">
    <div class="star-works-panel__filters" aria-label="作品筛选">
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

    <div class="star-works-panel__list">
      <article v-for="work in filteredWorks" :key="work.id">
        <img
          v-if="work.type === 'image' && getWorkPreviewUrl(work)"
          class="star-works-panel__work-preview"
          :src="getWorkPreviewUrl(work)!"
          :alt="work.title"
        >
        <audio
          v-else-if="work.type === 'music' && getWorkPreviewUrl(work)"
          class="star-works-panel__work-audio"
          data-kind="music"
          :src="getWorkPreviewUrl(work)!"
          controls
        />
        <video
          v-else-if="work.type === 'video' && getWorkPreviewUrl(work)"
          class="star-works-panel__work-preview"
          :src="getWorkPreviewUrl(work)!"
          controls
        />
        <button type="button" :aria-label="`查看作品：${work.title}`" @click="selectWork(work.id)">
          <strong>{{ work.title }}</strong>
          <span>{{ work.summary }}</span>
          <span>{{ getWorkVisibilityLabel(work.visibility) }}</span>
          <span v-if="getWorkDisclosureLabel(work)">{{ getWorkDisclosureLabel(work) }}</span>
        </button>
        <button type="button" :aria-label="work.visibility === 'public' ? '设为私密作品' : '公开作品'" @click="toggleWorkVisibility(work)">
          {{ work.visibility === 'public' ? '设为私密' : '公开' }}
        </button>
      </article>
      <p v-if="!filteredWorks.length" class="star-works-panel__muted">
        还没有作品
      </p>
    </div>

    <section v-if="selectedWork" class="star-works-panel__detail">
      <p>作品</p>
      <strong>{{ selectedWork.title }}</strong>
      <span>{{ selectedWork.summary }}</span>
      <span>{{ selectedWork.type }} · {{ getWorkVisibilityLabel(selectedWork.visibility) }}</span>
      <span v-if="getWorkDisclosureLabel(selectedWork)">{{ getWorkDisclosureLabel(selectedWork) }}</span>
      <span v-if="selectedWork.sourceConversationId">来源 {{ selectedWork.sourceConversationId }}</span>
      <span v-if="selectedWork.sourceDesignVersion">设计版本 {{ selectedWork.sourceDesignVersion }}</span>
      <img v-if="selectedWork.type === 'image' && getWorkPreviewUrl(selectedWork)" :src="getWorkPreviewUrl(selectedWork)!" :alt="selectedWork.title">
      <audio v-else-if="selectedWork.type === 'music' && getWorkPreviewUrl(selectedWork)" :src="getWorkPreviewUrl(selectedWork)!" controls />
      <video v-else-if="selectedWork.type === 'video' && getWorkPreviewUrl(selectedWork)" :src="getWorkPreviewUrl(selectedWork)!" controls />
      <span v-else-if="selectedWork.type === 'page_design' && getWorkSchemaTitle(selectedWork)">
        {{ getWorkSchemaTitle(selectedWork) }}
      </span>
    </section>
  </section>
</template>
