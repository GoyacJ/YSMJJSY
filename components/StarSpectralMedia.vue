<script setup lang="ts">
import { computed } from 'vue'
import StarAudioPlayer from './StarAudioPlayer.vue'
import type { StarChatPart } from '../composables/useStarChat'

const props = defineProps<{
  part: Extract<StarChatPart, { type: 'audio' | 'image' | 'music' | 'video' }>
}>()

function getMediaSource(part: StarChatPart) {
  if (!['audio', 'image', 'music', 'video'].includes(part.type)) {
    return undefined
  }

  if ('url' in part && part.url) {
    return part.url
  }

  if (!('base64' in part) || !part.base64) {
    return undefined
  }

  return part.type === 'image'
    ? `data:image/png;base64,${part.base64}`
    : `data:audio/mpeg;base64,${part.base64}`
}

function getMediaDownloadName(part: StarChatPart) {
  const names: Partial<Record<StarChatPart['type'], string>> = {
    image: 'star-image.png',
    audio: 'star-audio.mp3',
    music: 'star-music.mp3',
    video: 'star-video.mp4',
  }

  return names[part.type]
}

const source = computed(() => getMediaSource(props.part))
const downloadName = computed(() => getMediaDownloadName(props.part))
</script>

<template>
  <figure v-if="source" class="star-spectral-media" :data-kind="part.type">
    <div v-if="part.type === 'image'" class="star-spectral-media__shard">
      <img
        :src="source"
        alt="生成的图片"
      >
    </div>
    <StarAudioPlayer
      v-else-if="part.type === 'audio' || part.type === 'music'"
      :src="source"
      :kind="part.type"
    />
    <video
      v-else-if="part.type === 'video'"
      controls
      :src="source"
    />

    <figcaption class="star-spectral-media__actions">
      <a
        :href="source"
        :download="downloadName"
        target="_blank"
        rel="noreferrer"
        aria-label="下载资源"
        @click.stop
      >
        下载
      </a>
    </figcaption>
  </figure>
</template>
