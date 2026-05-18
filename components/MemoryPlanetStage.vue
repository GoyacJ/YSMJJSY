<script setup lang="ts">
import { computed } from 'vue'
import type { MemoryPlanetState } from '../utils/memory-planet'

const props = defineProps<{
  state: MemoryPlanetState
}>()

const hasStageContent = computed(() => {
  return props.state.memoryStars.length > 0
    || props.state.reflectionNebulas.length > 0
    || props.state.proposalLights.length > 0
    || props.state.orbitRings.length > 0
})

const emit = defineEmits<{
  selectMemory: [id: string]
  selectProposal: [id: string]
}>()

function getPositionStyle(position: { x: number, y: number }) {
  return {
    '--planet-x': `${position.x}%`,
    '--planet-y': `${position.y}%`,
  }
}
</script>

<template>
  <div class="memory-planet-stage" aria-label="记忆星球可视化">
    <span class="memory-planet-stage__core" aria-hidden="true" />
    <span v-if="!hasStageContent" class="memory-planet-stage__empty">暂无星体</span>

    <span
      v-for="ring in state.orbitRings"
      :key="ring.id"
      class="memory-planet-stage__orbit-ring"
      :data-status="ring.status"
      aria-hidden="true"
    />

    <span
      v-for="nebula in state.reflectionNebulas"
      :key="nebula.id"
      class="memory-planet-stage__nebula"
      :style="getPositionStyle(nebula.position)"
      aria-hidden="true"
    />

    <button
      v-for="star in state.memoryStars"
      :key="star.id"
      type="button"
      class="memory-planet-stage__memory"
      :class="{ 'memory-planet-stage__memory--bright': star.bright }"
      :style="getPositionStyle(star.position)"
      :aria-label="`查看记忆：${star.label}`"
      @click="emit('selectMemory', star.id)"
    >
      <span aria-hidden="true" />
    </button>

    <button
      v-for="proposal in state.proposalLights"
      :key="proposal.id"
      type="button"
      class="memory-planet-stage__proposal"
      :style="getPositionStyle(proposal.position)"
      :aria-label="`查看进化提案：${proposal.title}`"
      @click="emit('selectProposal', proposal.id)"
    >
      <span aria-hidden="true" />
    </button>
  </div>
</template>
