<script setup lang="ts">
import { ref } from 'vue'
import { useMediaTasks, type GeneratedAssetItem, type GeneratedAssetKind } from '../composables/useMediaTasks'

const props = withDefaults(defineProps<{
  sourceText?: string
}>(), {
  sourceText: '这封信里的星光',
})

const media = useMediaTasks()
const assets = ref<GeneratedAssetItem[]>([])
const pendingKind = ref<GeneratedAssetKind | ''>('')

function addAsset(asset: Omit<GeneratedAssetItem, 'id'>) {
  const item = {
    id: crypto.randomUUID(),
    ...asset,
  }

  assets.value.unshift(item)
  return item
}

async function createSpeech() {
  pendingKind.value = 'audio'
  const asset = addAsset({ kind: 'audio', status: 'pending' })

  try {
    const result = await media.createSpeech(props.sourceText)
    Object.assign(asset, { status: 'succeeded', ...result })
  }
  catch {
    Object.assign(asset, { status: 'failed', error: '这段声音没有生成好。' })
  }
  finally {
    pendingKind.value = ''
  }
}

async function createImage() {
  pendingKind.value = 'image'
  const asset = addAsset({ kind: 'image', status: 'pending' })

  try {
    const result = await media.createImage(props.sourceText)
    Object.assign(asset, { status: 'succeeded', ...result })
  }
  catch {
    Object.assign(asset, { status: 'failed', error: '这张图没有生成好。' })
  }
  finally {
    pendingKind.value = ''
  }
}

async function createVideo() {
  pendingKind.value = 'video'
  const asset = addAsset({ kind: 'video', status: 'pending' })

  try {
    const task = await media.createVideo(props.sourceText)
    const result = await media.pollVideoTask(task.taskId)
    Object.assign(asset, result)
  }
  catch {
    Object.assign(asset, { status: 'failed', error: '这段视频还没准备好。' })
  }
  finally {
    pendingKind.value = ''
  }
}

async function createMusic() {
  pendingKind.value = 'music'
  const asset = addAsset({ kind: 'music', status: 'pending' })

  try {
    const result = await media.createMusic(props.sourceText)
    Object.assign(asset, { status: 'succeeded', ...result })
  }
  catch {
    Object.assign(asset, { status: 'failed', error: '这首歌没有生成好。' })
  }
  finally {
    pendingKind.value = ''
  }
}
</script>

<template>
  <section class="media-panel" aria-label="纪念内容生成">
    <div class="media-panel__actions">
      <button type="button" :disabled="pendingKind !== ''" @click="createSpeech">
        听一听
      </button>
      <button type="button" :disabled="pendingKind !== ''" @click="createImage">
        画一张
      </button>
      <button type="button" :disabled="pendingKind !== ''" @click="createVideo">
        做一段
      </button>
      <button type="button" :disabled="pendingKind !== ''" @click="createMusic">
        写一首
      </button>
    </div>

    <div v-if="assets.length > 0" class="media-panel__assets">
      <GeneratedAsset v-for="asset in assets" :key="asset.id" :asset="asset" />
    </div>
  </section>
</template>
