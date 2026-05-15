<script setup lang="ts">
import type { UnlockResult } from '../composables/useUnlock'

const phase = ref<'locked' | 'configuring' | 'reading' | 'star'>('locked')
const { unlock, createKey } = useUnlock()
const {
  currentSchema,
  previewSchema,
  loadDesign,
  previewDesign,
  commitDesign,
  discardPreview,
} = useKeyDesign()

function handleUnlocked(result: UnlockResult) {
  phase.value = result.needsConfig ? 'configuring' : 'reading'
}

async function enterStar() {
  await loadDesign()
  phase.value = 'star'
}
</script>

<template>
  <main class="app-page">
    <UnlockGate
      v-if="phase === 'locked'"
      :unlock="unlock"
      :create-key="createKey"
      @unlocked="handleUnlocked"
      @created="handleUnlocked"
    />
    <KeySetupPanel
      v-else-if="phase === 'configuring'"
      @configured="phase = 'reading'"
    />
    <LetterScene v-else-if="phase === 'reading'" @finished="enterStar" />
    <ClientOnly v-else>
      <DynamicStarPage v-if="currentSchema" :schema="currentSchema" />
      <StarScene v-else />
      <StarChat @design-requested="previewDesign" />
      <DesignPreviewSheet
        v-if="previewSchema"
        :schema="previewSchema"
        @confirm="commitDesign()"
        @cancel="discardPreview"
      />
    </ClientOnly>
  </main>
</template>
