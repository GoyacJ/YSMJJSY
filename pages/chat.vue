<script setup lang="ts">
const {
  currentSchema,
  previewSchema,
  loadDesign,
  previewDesign,
  commitDesign,
  discardPreview,
} = useKeyDesign()

onMounted(async () => {
  const schema = await loadDesign()

  if (!schema) {
    await navigateTo('/')
  }
})
</script>

<template>
  <main class="app-page">
    <ClientOnly>
      <DynamicStarPage v-if="currentSchema" :schema="currentSchema" />
      <StarScene v-else />
      <StarChat @design-requested="previewDesign" />
      <ProfileSettingsSheet />
      <DesignPreviewSheet
        v-if="previewSchema"
        :schema="previewSchema"
        @confirm="commitDesign()"
        @cancel="discardPreview"
      />
    </ClientOnly>
  </main>
</template>
