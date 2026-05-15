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

function usedPercent(item: MiniMaxQuotaItem) {
  return item.total > 0 ? `${Math.min(100, (item.used / item.total) * 100)}%` : '0%'
}

function formatQuota(item: MiniMaxQuotaItem) {
  return item.total > 0 ? `${item.remaining}/${item.total}` : '暂不可用'
}

function formatReset(resetAt?: string) {
  if (!resetAt) {
    return ''
  }

  return new Date(resetAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
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
      <span>额度</span>
      <button type="button" :disabled="pending" @click="loadQuota">
        {{ pending ? '读取中' : '刷新' }}
      </button>
    </header>

    <p v-if="error" class="quota-panel__error" role="status">
      {{ error }}
    </p>

    <div v-else-if="visibleQuotas.length > 0" class="quota-panel__list">
      <div
        v-for="item in visibleQuotas"
        :key="item.key"
        class="quota-panel__item"
        :data-available="item.available"
      >
        <div class="quota-panel__meta">
          <span>{{ item.label }}</span>
          <small>
            {{ formatQuota(item) }}
            <template v-if="item.resetAt">
              · {{ formatReset(item.resetAt) }}
            </template>
          </small>
        </div>
        <div class="quota-panel__track" aria-hidden="true">
          <span :style="{ width: usedPercent(item) }" />
        </div>
      </div>
    </div>

    <p v-else class="quota-panel__empty" role="status">
      {{ pending ? '读取中' : '暂无额度数据' }}
    </p>
  </section>
</template>
