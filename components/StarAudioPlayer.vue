<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  src: string
  kind: 'audio' | 'music'
  title?: string
}>()

const audioRef = ref<HTMLAudioElement>()
const currentTime = ref(0)
const duration = ref(0)
const playing = ref(false)
const muted = ref(false)

const formattedCurrent = computed(() => formatTime(currentTime.value))
const formattedDuration = computed(() => duration.value > 0 ? formatTime(duration.value) : '0:00')
const progress = computed(() => duration.value > 0 ? Math.min(100, (currentTime.value / duration.value) * 100) : 0)
const playerTitle = computed(() => props.title || (props.kind === 'music' ? '星空音乐' : '星信语音'))
const playerTone = computed(() => props.kind === 'music' ? '旋律' : '语音')
const waveformBars = [34, 58, 46, 76, 64, 88, 48, 70, 92, 54, 80, 62, 96, 74, 52, 84, 66, 44, 72, 90, 56, 78, 40, 68, 50, 82, 60, 36]

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0:00'
  }

  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

async function togglePlay() {
  if (!audioRef.value) {
    return
  }

  if (audioRef.value.paused) {
    await audioRef.value.play()
  }
  else {
    audioRef.value.pause()
  }
}

function syncTime() {
  currentTime.value = audioRef.value?.currentTime ?? 0
}

function syncMetadata() {
  duration.value = audioRef.value?.duration ?? 0
}

function syncPlaying() {
  playing.value = !audioRef.value?.paused
}

function seek(event: Event) {
  if (!audioRef.value) {
    return
  }

  const value = Number((event.target as HTMLInputElement).value)
  const nextTime = duration.value > 0 ? (value / 100) * duration.value : 0
  audioRef.value.currentTime = nextTime
  currentTime.value = nextTime
}

function toggleMute() {
  if (!audioRef.value) {
    return
  }

  audioRef.value.muted = !audioRef.value.muted
  muted.value = audioRef.value.muted
}

function syncMuted() {
  muted.value = Boolean(audioRef.value?.muted)
}
</script>

<template>
  <div class="star-audio-player" :data-kind="kind">
    <audio
      ref="audioRef"
      class="star-audio-player__native"
      :data-kind="kind"
      :src="src"
      preload="metadata"
      @durationchange="syncMetadata"
      @loadedmetadata="syncMetadata"
      @timeupdate="syncTime"
      @play="syncPlaying"
      @pause="syncPlaying"
      @ended="syncPlaying"
      @volumechange="syncMuted"
    />

    <button
      type="button"
      class="star-audio-player__play"
      :aria-label="playing ? '暂停播放' : '开始播放'"
      @click.stop="togglePlay"
    >
      <svg v-if="playing" class="star-audio-player__pause-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 5h3v14H8zM13 5h3v14h-3z" />
      </svg>
      <svg v-else class="star-audio-player__play-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 5v14l11-7z" />
      </svg>
    </button>

    <div class="star-audio-player__body" :style="{ '--progress': `${progress}%` }">
      <div class="star-audio-player__meta">
        <span>{{ playerTitle }}</span>
        <small>{{ playerTone }} · {{ formattedCurrent }} / {{ formattedDuration }}</small>
      </div>

      <label class="star-audio-player__range">
        <span class="sr-only">播放进度</span>
        <span class="star-audio-player__waveform">
          <span class="star-audio-player__wave-layer star-audio-player__wave-layer--base" aria-hidden="true">
            <span
              v-for="(height, index) in waveformBars"
              :key="`base-${index}`"
              :style="{ '--level': `${height}%`, '--delay': `${index * 32}ms` }"
            />
          </span>
          <span class="star-audio-player__wave-layer star-audio-player__wave-layer--fill" aria-hidden="true">
            <span
              v-for="(height, index) in waveformBars"
              :key="`fill-${index}`"
              :style="{ '--level': `${height}%`, '--delay': `${index * 32}ms` }"
            />
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            :value="progress"
            @input="seek"
            @click.stop
          >
        </span>
      </label>
    </div>

    <button
      type="button"
      class="star-audio-player__mute"
      :aria-label="muted ? '取消静音' : '静音'"
      @click.stop="toggleMute"
    >
      <svg v-if="muted" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4Zm12.3 1.1L18.2 12l-1.9 1.9 1.4 1.4 1.9-1.9 1.9 1.9 1.4-1.4L21 12l1.9-1.9-1.4-1.4-1.9 1.9-1.9-1.9-1.4 1.4Z" />
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4Zm12.5-1.8-1.4 1.4A5 5 0 0 1 17 12a5 5 0 0 1-1.9 3.9l1.4 1.4A7 7 0 0 0 19 12a7 7 0 0 0-2.5-4.8Z" />
      </svg>
    </button>
  </div>
</template>
