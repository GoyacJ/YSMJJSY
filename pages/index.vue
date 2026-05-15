<script setup lang="ts">
const phase = ref<'locked' | 'reading' | 'star'>('locked')
const { unlock } = useUnlock()
</script>

<template>
  <main class="app-page">
    <UnlockGate
      v-if="phase === 'locked'"
      :unlock="unlock"
      @unlocked="phase = 'reading'"
    />
    <LetterScene v-else-if="phase === 'reading'" @finished="phase = 'star'" />
    <ClientOnly v-else>
      <StarScene />
    </ClientOnly>
  </main>
</template>
