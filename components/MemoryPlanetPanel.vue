<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MemoryPlanetStage from './MemoryPlanetStage.vue'
import type { AgentCore, MemoryGovernanceAction } from '../composables/useAgentCore'
import { buildMemoryPlanetState } from '../utils/memory-planet'

const props = defineProps<{
  core: AgentCore | null
  open: boolean
  governMemory?: (id: string, action: MemoryGovernanceAction) => Promise<boolean>
}>()

defineEmits<{
  close: []
}>()

const selectedMemoryId = ref<string | null>(null)
const selectedProposalId = ref<string | null>(null)
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
</script>

<template>
  <aside v-if="open" class="memory-planet-panel" role="dialog" aria-label="记忆星球">
    <header>
      <div>
        <p>记忆星球</p>
        <span>记忆、反思和进化轨道</span>
      </div>
      <button type="button" aria-label="关闭记忆星球" @click="$emit('close')">
        ×
      </button>
    </header>

    <div class="memory-planet-panel__layout">
      <MemoryPlanetStage
        :state="state"
        @select-memory="selectMemory"
        @select-proposal="selectProposal"
      />

      <section class="memory-planet-panel__ai" aria-label="星AI">
        <AgentCorePanel embedded />
      </section>
    </div>

    <section class="memory-planet-panel__detail">
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
</template>
