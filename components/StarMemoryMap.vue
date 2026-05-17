<script setup lang="ts">
const emit = defineEmits<{
  'open-planet': []
  'open-settings': []
}>()
</script>

<template>
  <aside class="star-memory-map" aria-label="记忆星球">
    <button type="button" aria-label="打开记忆星球" @click="emit('open-planet')">
      <span class="star-memory-map__constellation" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>
        <strong>记忆星球</strong>
        <small>记忆、反思和进化轨道</small>
      </span>
    </button>
    <button type="button" class="star-memory-map__settings" aria-label="打开星信设置" @click="emit('open-settings')">
      <span class="star-memory-map__settings-label">设置</span>
    </button>
  </aside>
</template>
