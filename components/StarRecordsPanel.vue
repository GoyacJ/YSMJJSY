<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAgentOs, type AgentOsInboxItem, type AgentOsState } from '../composables/useAgentOs'

const props = defineProps<{
  os?: AgentOsState | null
  loadOs?: () => Promise<AgentOsState | null>
  approveInboxItem?: (id: string) => Promise<boolean>
  rejectInboxItem?: (id: string) => Promise<boolean>
  previewDesignProposal?: (id: string) => Promise<boolean>
}>()

const agentOs = useAgentOs()
const loadedOs = ref<AgentOsState | null>(props.os ?? null)
const pending = ref(false)
const error = ref('')
const expandedRecordId = ref<string | null>(null)

const inboxItems = computed(() => loadedOs.value?.inbox ?? [])
const records = computed(() => loadedOs.value?.records ?? [])

watch(
  () => props.os,
  (os) => {
    if (os) {
      loadedOs.value = os
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (!loadedOs.value) {
    void loadRecords()
  }
})

async function loadRecords() {
  pending.value = true
  error.value = ''

  try {
    loadedOs.value = props.loadOs ? await props.loadOs() : await agentOs.loadOs()
  }
  catch {
    error.value = '记录没有加载成功。'
  }
  finally {
    pending.value = false
  }
}

function normalizeInboxActionId(item: AgentOsInboxItem) {
  return item.id.includes(':') ? item.id : `${item.type}:${item.id}`
}

function getInboxTargetId(item: AgentOsInboxItem) {
  const id = normalizeInboxActionId(item)
  const separator = id.indexOf(':')
  const target = separator === -1 ? id : id.slice(separator + 1)
  return target.includes(':') ? target.slice(0, target.indexOf(':')) : target
}

function getInboxApproveLabel(item: AgentOsInboxItem) {
  if (item.type === 'work_visibility') return '公开'
  if (item.type === 'memory_governance') return '执行'
  if (item.type === 'rollback') return '回滚'
  return '批准'
}

function formatTime(value?: string | null) {
  if (!value) return '未记录'
  return value.replace('T', ' ').replace('.000Z', '')
}

function hasRecordDetails(record: { details?: { sections: Array<{ title: string, items: string[] }> } }) {
  return Boolean(record.details?.sections.length)
}

function toggleRecordDetails(recordId: string) {
  expandedRecordId.value = expandedRecordId.value === recordId ? null : recordId
}

async function approveInbox(item: AgentOsInboxItem) {
  pending.value = true
  error.value = ''

  try {
    const ok = props.approveInboxItem
      ? await props.approveInboxItem(normalizeInboxActionId(item))
      : await agentOs.approveInboxItem(normalizeInboxActionId(item))

    if (ok) {
      await loadRecords()
    }
  }
  catch {
    error.value = '待办没有批准成功。'
  }
  finally {
    pending.value = false
  }
}

async function rejectInbox(item: AgentOsInboxItem) {
  pending.value = true
  error.value = ''

  try {
    const ok = props.rejectInboxItem
      ? await props.rejectInboxItem(normalizeInboxActionId(item))
      : await agentOs.rejectInboxItem(normalizeInboxActionId(item))

    if (ok) {
      await loadRecords()
    }
  }
  catch {
    error.value = '待办没有拒绝成功。'
  }
  finally {
    pending.value = false
  }
}

async function previewInboxProposal(item: AgentOsInboxItem) {
  if (!props.previewDesignProposal || item.type !== 'proposal') {
    return
  }

  pending.value = true
  error.value = ''

  try {
    await props.previewDesignProposal(getInboxTargetId(item))
  }
  catch {
    error.value = '页面预览没有生成成功。'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="star-records-panel" aria-label="记录">
    <p v-if="pending" class="star-records-panel__muted">
      正在读取
    </p>
    <p v-else-if="error" class="star-records-panel__error" role="alert">
      {{ error }}
    </p>

    <section class="star-records-panel__section">
      <p class="star-records-panel__label">
        待确认行动
      </p>
      <ul v-if="inboxItems.length" class="star-records-panel__list">
        <li v-for="item in inboxItems" :key="`${item.type}:${item.id}`">
          <strong>{{ item.title }}</strong>
          <span>{{ item.summary }}</span>
          <small>{{ formatTime(item.createdAt) }}</small>
          <div>
            <button
              v-if="item.type === 'proposal' && previewDesignProposal"
              type="button"
              aria-label="生成页面预览"
              :disabled="pending"
              @click="previewInboxProposal(item)"
            >
              生成预览
            </button>
            <button type="button" :disabled="pending" @click="approveInbox(item)">
              {{ getInboxApproveLabel(item) }}
            </button>
            <button type="button" :disabled="pending" @click="rejectInbox(item)">
              拒绝
            </button>
          </div>
        </li>
      </ul>
      <p v-else class="star-records-panel__muted">
        没有待处理事项
      </p>
    </section>

    <section class="star-records-panel__section">
      <p class="star-records-panel__label">
        记录流
      </p>
      <ul v-if="records.length" class="star-records-panel__list">
        <li v-for="record in records" :key="record.id">
          <strong>{{ record.title }}</strong>
          <span>{{ record.summary }}</span>
          <small>{{ record.type }} · {{ record.status }} · {{ formatTime(record.createdAt) }}</small>
          <button
            v-if="hasRecordDetails(record)"
            type="button"
            :aria-label="expandedRecordId === record.id ? '收起整理报告' : '展开整理报告'"
            @click="toggleRecordDetails(record.id)"
          >
            {{ expandedRecordId === record.id ? '收起' : '详情' }}
          </button>
          <div v-if="expandedRecordId === record.id && record.details" class="star-records-panel__details">
            <section v-for="section in record.details.sections" :key="section.title">
              <strong>{{ section.title }}</strong>
              <ul>
                <li v-for="item in section.items" :key="item">
                  {{ item }}
                </li>
              </ul>
            </section>
          </div>
        </li>
      </ul>
      <p v-else class="star-records-panel__muted">
        还没有记录
      </p>
    </section>
  </section>
</template>
