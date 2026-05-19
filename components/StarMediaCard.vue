<script setup lang="ts">
import { computed } from 'vue'
import StarAudioPlayer from './StarAudioPlayer.vue'
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
const isProcessing = computed(() =>
  ['music', 'video'].includes(props.part.type)
  && !source.value
  && 'status' in props.part
  && props.part.status === 'processing',
)
const isFailed = computed(() =>
  ['music', 'video'].includes(props.part.type)
  && !source.value
  && 'status' in props.part
  && props.part.status === 'failed',
)
</script>

<template>
  <figure v-if="source" class="star-media-card" :data-kind="part.type">
    <img
      v-if="part.type === 'image'"
      class="star-media-card__image"
      :src="source"
      alt="生成的图片"
    >
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
    <figcaption class="star-media-card__actions">
      <span class="star-media-card__disclosure">AI 生成</span>
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
  <figure v-else-if="isProcessing" class="star-media-card" :data-kind="part.type" data-status="processing">
    <figcaption class="star-media-card__actions">
      <span class="star-media-card__disclosure">AI 生成</span>
      <span>{{ part.type === 'music' ? '音乐生成中' : '视频生成中' }}</span>
    </figcaption>
  </figure>
  <figure v-else-if="isFailed" class="star-media-card" :data-kind="part.type" data-status="failed">
    <figcaption class="star-media-card__actions">
      <span class="star-media-card__disclosure">AI 生成</span>
      <span>{{ part.type === 'music' ? '音乐生成失败' : '视频生成失败' }}</span>
    </figcaption>
  </figure>
</template>
