<script setup lang="ts">
import type { UnlockResult } from '../composables/useUnlock'
import type { PublicStar } from '../utils/public-star-scene'
import { findChangedActivityIds } from '../utils/public-star-scene'

const { unlock, createKey } = useUnlock()
const { data, refresh } = await useFetch<{ stars: PublicStar[] }>('/api/public-stars', {
  default: () => ({ stars: [] }),
})
const publicStars = computed(() => data.value?.stars ?? [])
const previousStars = ref<PublicStar[]>([])
const flashIds = ref<string[]>([])
const hasLoadedStars = ref(false)
let refreshInterval: number | undefined

watch(publicStars, (nextStars) => {
  if (!hasLoadedStars.value) {
    previousStars.value = [...nextStars]
    hasLoadedStars.value = true
    return
  }

  const changedIds = findChangedActivityIds(previousStars.value, nextStars)

  if (changedIds.length > 0) {
    flashIds.value = changedIds
  }

  previousStars.value = [...nextStars]
}, { immediate: true })

onMounted(() => {
  refreshInterval = window.setInterval(() => {
    refresh()
  }, 15_000)
})

onBeforeUnmount(() => {
  if (refreshInterval) {
    window.clearInterval(refreshInterval)
  }
})

function handleUnlocked(result: UnlockResult) {
  return navigateTo(result.needsConfig ? '/setup' : '/chat')
}
</script>

<template>
  <main class="app-page">
    <ClientOnly>
      <PublicStarHome :stars="publicStars" :flash-ids="flashIds">
        <div class="home-entry">
          <h1 class="home-entry__title">
            余生梦见皆是缘
          </h1>
          <p class="home-entry__copy">
            一把钥匙，进入只属于你的私人星球。
          </p>
          <ul class="home-entry__signals" aria-label="星球能力">
            <li>私密记忆</li>
            <li>私人作品</li>
            <li>可改边界</li>
          </ul>
          <UnlockGate
            :unlock="unlock"
            :create-key="createKey"
            @unlocked="handleUnlocked"
            @created="handleUnlocked"
          />
        </div>
      </PublicStarHome>
      <template #fallback>
        <div class="home-entry home-entry--fallback">
          <h1 class="home-entry__title">
            余生梦见皆是缘
          </h1>
          <p class="home-entry__copy">
            一把钥匙，进入只属于你的私人星球。
          </p>
          <ul class="home-entry__signals" aria-label="星球能力">
            <li>私密记忆</li>
            <li>私人作品</li>
            <li>可改边界</li>
          </ul>
          <UnlockGate
            :unlock="unlock"
            :create-key="createKey"
            @unlocked="handleUnlocked"
            @created="handleUnlocked"
          />
        </div>
      </template>
    </ClientOnly>
  </main>
</template>
