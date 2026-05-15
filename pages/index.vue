<script setup lang="ts">
import type { UnlockResult } from '../composables/useUnlock'

const phase = ref<'locked' | 'configuring' | 'reading' | 'star'>('locked')
const { unlock } = useUnlock()

function handleUnlocked(result: UnlockResult) {
  phase.value = result.needsConfig ? 'configuring' : 'reading'
}
</script>

<template>
  <main class="app-page">
    <UnlockGate
      v-if="phase === 'locked'"
      :unlock="unlock"
      @unlocked="handleUnlocked"
    />
    <KeySetupPanel
      v-else-if="phase === 'configuring'"
      @configured="phase = 'reading'"
    />
    <LetterScene v-else-if="phase === 'reading'" @finished="phase = 'star'" />
    <ClientOnly v-else>
      <StarScene />
      <StarChat />
    </ClientOnly>
  </main>
</template>
