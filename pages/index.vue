<script setup lang="ts">
import type { UnlockResult } from '../composables/useUnlock'

const { unlock, createKey } = useUnlock()

function handleUnlocked(result: UnlockResult) {
  return navigateTo(result.needsConfig ? '/setup' : '/chat')
}
</script>

<template>
  <main class="app-page">
    <UnlockGate
      :unlock="unlock"
      :create-key="createKey"
      @unlocked="handleUnlocked"
      @created="handleUnlocked"
    />
  </main>
</template>
