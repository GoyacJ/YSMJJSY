<script setup lang="ts">
import { computed } from 'vue'
import StarAudioPlayer from './StarAudioPlayer.vue'
import type { GeneratedAssetItem } from '../composables/useMediaTasks'

const props = defineProps<{
  asset: GeneratedAssetItem
}>()

const source = computed(() => {
  if (props.asset.url) {
    return props.asset.url
  }

  if (!props.asset.base64) {
    return undefined
  }

  return props.asset.kind === 'image'
    ? `data:image/png;base64,${props.asset.base64}`
    : `data:audio/mpeg;base64,${props.asset.base64}`
})
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
    <p v-else-if="!source">
      没有拿到可播放文件。
    </p>
    <template v-else>
      <StarAudioPlayer
        v-if="asset.kind === 'audio' || asset.kind === 'music'"
        :src="source"
        :kind="asset.kind"
      />
      <img
        v-else-if="asset.kind === 'image'"
        :src="source"
        alt="生成的纪念图"
      >
      <video v-else controls :src="source" />
    </template>
  </article>
</template>
