<script setup lang="ts">
import { computed } from 'vue'
import type { StarChatPart } from '../composables/useStarChat'

const props = defineProps<{
  part: StarChatPart
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
  <figure v-if="source" class="star-media-card" :data-kind="part.type">
    <img
      v-if="part.type === 'image'"
      class="star-media-card__image"
      :src="source"
      alt="生成的图片"
    >
    <audio
      v-else-if="part.type === 'audio' || part.type === 'music'"
      controls
      :data-kind="part.type"
      :src="source"
    />
    <video
      v-else-if="part.type === 'video'"
      controls
      :src="source"
    />
    <figcaption class="star-media-card__actions">
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
