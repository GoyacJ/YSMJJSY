<script setup lang="ts">
import type { GeneratedAssetItem } from '../composables/useMediaTasks'

defineProps<{
  asset: GeneratedAssetItem
}>()
</script>

<template>
  <article class="generated-asset" :data-status="asset.status">
    <p v-if="asset.status === 'pending'">
      正在生成
    </p>
    <p v-else-if="asset.status === 'processing'">
      正在处理中
    </p>
    <p v-else-if="asset.status === 'failed'">
      {{ asset.error || '没有生成好。' }}
    </p>
    <p v-else-if="!asset.url && !asset.base64">
      没有拿到可播放文件。
    </p>
    <template v-else>
      <audio
        v-if="asset.kind === 'audio' || asset.kind === 'music'"
        controls
        :src="asset.url || (asset.base64 ? `data:audio/mpeg;base64,${asset.base64}` : undefined)"
      />
      <img
        v-else-if="asset.kind === 'image'"
        :src="asset.url || (asset.base64 ? `data:image/png;base64,${asset.base64}` : undefined)"
        alt="生成的纪念图"
      >
      <video v-else controls :src="asset.url" />
    </template>
  </article>
</template>
