<script setup lang="ts">
const phase = ref<'locked' | 'reading'>('locked')
const { unlock } = useUnlock()
</script>

<template>
  <main class="app-page">
    <UnlockGate
      v-if="phase === 'locked'"
      :unlock="unlock"
      @unlocked="phase = 'reading'"
    />
    <LetterScene v-else />
  </main>
</template>
