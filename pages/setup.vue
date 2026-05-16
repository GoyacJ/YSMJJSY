<script setup lang="ts">
function handleConfigured() {
  return navigateTo('/chat')
}
</script>

<template>
  <main class="app-page">
    <KeySetupPanel @configured="handleConfigured" />
  </main>
</template>
