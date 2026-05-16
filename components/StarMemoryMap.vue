<script setup lang="ts">
const emit = defineEmits<{
  'open-settings': []
}>()
</script>

<template>
  <aside class="star-memory-map" aria-label="记忆星图">
    <button type="button" aria-label="打开记忆星图" @click="emit('open-settings')">
      <span class="star-memory-map__constellation" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>
        <strong>记忆星图</strong>
        <small>称呼、性格和她的星点</small>
      </span>
    </button>
  </aside>
</template>
