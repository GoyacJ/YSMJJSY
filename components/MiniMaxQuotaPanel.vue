<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

type MiniMaxQuotaItem = {
  key: 'chat' | 'audio' | 'image' | 'music' | 'video'
  label: string
  used: number
  total: number
  remaining: number
  available: boolean
  resetAt?: string
}

const props = defineProps<{
  fetchQuota?: () => Promise<MiniMaxQuotaItem[]>
}>()

const quotas = ref<MiniMaxQuotaItem[]>([])
const pending = ref(false)
const error = ref('')

const visibleQuotas = computed(() => quotas.value.filter(item => item.key !== 'chat'))

function formatQuota(item: MiniMaxQuotaItem) {
  return item.total > 0 ? `${item.remaining}/${item.total}` : '暂不可用'
}

function formatLabel(item: MiniMaxQuotaItem) {
  const labels: Record<MiniMaxQuotaItem['key'], string> = {
    chat: '星信',
    audio: '语音',
    image: '图像',
    music: '音乐',
    video: '视频',
  }

  return labels[item.key] || item.label
}

function formatQuotaText(item: MiniMaxQuotaItem) {
  return item.available && item.total > 0
    ? `${formatLabel(item)} ${formatQuota(item)}`
    : `${formatLabel(item)}暂不可用`
}

async function loadQuota() {
  pending.value = true
  error.value = ''

  try {
    quotas.value = props.fetchQuota
      ? await props.fetchQuota()
      : await $fetch<MiniMaxQuotaItem[]>('/api/minimax/quota')
  }
  catch {
    error.value = '额度暂时没有读到'
  }
  finally {
    pending.value = false
  }
}

onMounted(() => {
  void loadQuota()
})
</script>

<template>
  <section class="quota-panel" aria-label="MiniMax 当前额度">
    <header class="quota-panel__header">
      <span>星能量</span>
      <button type="button" :disabled="pending" @click="loadQuota">
        {{ pending ? '读取中' : '刷新' }}
      </button>
    </header>

    <p v-if="error" class="quota-panel__error" role="status">
      {{ error }}
    </p>

    <p v-else-if="visibleQuotas.length > 0" class="quota-panel__status" role="status">
      <span
        v-for="item in visibleQuotas"
        :key="item.key"
        class="quota-panel__status-item"
        :data-available="item.available"
      >
        {{ formatQuotaText(item) }}
      </span>
    </p>

    <p v-else class="quota-panel__empty" role="status">
      {{ pending ? '读取中' : '暂无额度数据' }}
    </p>
  </section>
</template>
