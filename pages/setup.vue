<script setup lang="ts">
type ConfiguredProfile = {
  keyId: string
  assistantName: string
}

function handleConfigured(profile: ConfiguredProfile) {
  if (import.meta.client) {
    window.localStorage.setItem('ysmjjsy:new-public-star', JSON.stringify({
      id: profile.keyId,
      name: profile.assistantName,
      at: new Date().toISOString(),
    }))
  }

  return navigateTo('/chat')
}
</script>

<template>
  <main class="app-page">
    <KeySetupPanel @configured="handleConfigured" />
  </main>
</template>
