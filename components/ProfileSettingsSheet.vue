<script setup lang="ts">
import { ref, watch } from 'vue'
import { withCsrfHeaders } from '../composables/useCsrf'

type ProfileUpdate = {
  assistantName: string
  mbti: string
  boundarySettings: StarBoundarySettings
}

type ProfileResult = ProfileUpdate & {
  keyId: string
  configured: boolean
}

type StarBoundarySettings = {
  memoryWriteMode: 'manual' | 'assisted' | 'auto'
  generatedWorksDefaultVisibility: 'private' | 'public'
  requireApprovalForPublishing: boolean
  requireApprovalForPersonaChange: boolean
  requireApprovalForSensitiveMemory: boolean
  disallowedMemoryTopics: string[]
  allowedMemoryTopics: string[]
  minorMode: boolean
}

const props = defineProps<{
  loadProfile?: () => Promise<ProfileResult>
  saveProfile?: (input: ProfileUpdate) => Promise<ProfileResult>
  open?: boolean
  hideTrigger?: boolean
  embedded?: boolean
}>()

const emit = defineEmits<{
  updated: [profile: ProfileResult]
  close: []
}>()

const mbtiOptions = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
]

const sheetOpen = ref(false)
const assistantName = ref('星信')
const mbti = ref('INTJ')
const memoryWriteMode = ref<StarBoundarySettings['memoryWriteMode']>('assisted')
const generatedWorksDefaultVisibility = ref<StarBoundarySettings['generatedWorksDefaultVisibility']>('private')
const requireApprovalForPublishing = ref(true)
const requireApprovalForPersonaChange = ref(true)
const requireApprovalForSensitiveMemory = ref(true)
const disallowedMemoryTopics = ref('')
const allowedMemoryTopics = ref('')
const minorMode = ref(false)
const pending = ref(false)
const error = ref('')
const deleteConfirmation = ref('')
const dataActionMessage = ref('')

const defaultBoundarySettings: StarBoundarySettings = {
  memoryWriteMode: 'assisted',
  generatedWorksDefaultVisibility: 'private',
  requireApprovalForPublishing: true,
  requireApprovalForPersonaChange: true,
  requireApprovalForSensitiveMemory: true,
  disallowedMemoryTopics: [],
  allowedMemoryTopics: [],
  minorMode: false,
}

async function defaultLoadProfile() {
  return await $fetch<ProfileResult>('/api/key/profile')
}

async function defaultSaveProfile(input: ProfileUpdate) {
  return await $fetch<ProfileResult>('/api/key/profile', {
    method: 'PUT',
    headers: withCsrfHeaders(),
    body: input,
  })
}

async function downloadJson(path: string, filename: string) {
  pending.value = true
  error.value = ''
  dataActionMessage.value = ''

  try {
    const payload = await $fetch<Record<string, unknown>>(path)
    const json = JSON.stringify(payload, null, 2)

    if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof URL !== 'undefined') {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    }

    dataActionMessage.value = '导出已生成。'
  }
  catch {
    error.value = '导出没有完成。'
  }
  finally {
    pending.value = false
  }
}

async function postConfirmedDelete(path: string, successMessage: string) {
  pending.value = true
  error.value = ''
  dataActionMessage.value = ''

  try {
    await $fetch(path, {
      method: 'POST',
      headers: withCsrfHeaders(),
      body: { confirm: deleteConfirmation.value },
    })
    deleteConfirmation.value = ''
    dataActionMessage.value = successMessage
  }
  catch {
    error.value = '删除没有完成。'
  }
  finally {
    pending.value = false
  }
}

async function openSettings() {
  sheetOpen.value = true
  pending.value = true
  error.value = ''

  try {
    const profile = props.loadProfile ? await props.loadProfile() : await defaultLoadProfile()
    assistantName.value = profile.assistantName || '星信'
    mbti.value = profile.mbti || 'INTJ'
    applyBoundarySettings(profile.boundarySettings)
  }
  catch {
    error.value = '设置没有读取成功。'
  }
  finally {
    pending.value = false
  }
}

async function submit() {
  pending.value = true
  error.value = ''

  try {
    const input = {
      assistantName: assistantName.value.trim(),
      mbti: mbti.value,
      boundarySettings: buildBoundarySettings(),
    }
    const profile = props.saveProfile ? await props.saveProfile(input) : await defaultSaveProfile(input)
    emit('updated', profile)
    closeSettings()
  }
  catch {
    error.value = '设置没有保存成功。'
  }
  finally {
    pending.value = false
  }
}

function applyBoundarySettings(settings?: StarBoundarySettings) {
  const next = settings ?? defaultBoundarySettings

  memoryWriteMode.value = next.memoryWriteMode
  generatedWorksDefaultVisibility.value = 'private'
  requireApprovalForPublishing.value = next.requireApprovalForPublishing
  requireApprovalForPersonaChange.value = next.requireApprovalForPersonaChange
  requireApprovalForSensitiveMemory.value = next.requireApprovalForSensitiveMemory
  disallowedMemoryTopics.value = next.disallowedMemoryTopics.join('\n')
  allowedMemoryTopics.value = next.allowedMemoryTopics.join('\n')
  minorMode.value = next.minorMode
}

function parseTopicList(value: string) {
  return value
    .split(/\n|,/)
    .map(item => item.trim())
    .filter(Boolean)
}

function buildBoundarySettings(): StarBoundarySettings {
  return {
    memoryWriteMode: memoryWriteMode.value,
    generatedWorksDefaultVisibility: 'private',
    requireApprovalForPublishing: requireApprovalForPublishing.value,
    requireApprovalForPersonaChange: requireApprovalForPersonaChange.value,
    requireApprovalForSensitiveMemory: requireApprovalForSensitiveMemory.value,
    disallowedMemoryTopics: parseTopicList(disallowedMemoryTopics.value),
    allowedMemoryTopics: parseTopicList(allowedMemoryTopics.value),
    minorMode: minorMode.value,
  }
}

function closeSettings() {
  sheetOpen.value = false
  emit('close')
}

watch(
  () => props.open,
  (nextOpen) => {
    if (nextOpen) {
      void openSettings()
      return
    }

    if (nextOpen === false) {
      sheetOpen.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="profile-settings" :class="{ 'profile-settings--embedded': embedded }">
    <button
      v-if="!hideTrigger"
      type="button"
      class="profile-settings__trigger"
      aria-label="打开设置"
      @click="openSettings"
    >
      设
    </button>

    <div v-if="sheetOpen" class="profile-settings__sheet" :class="{ 'profile-settings__sheet--embedded': embedded }" role="dialog" aria-label="星信设置">
      <form class="profile-settings__panel" @submit.prevent="submit">
        <header>
          <p>设置</p>
          <button type="button" class="dialog-close-button" aria-label="关闭设置" @click="closeSettings">
            ×
          </button>
        </header>

        <div class="profile-settings__quota">
          <MiniMaxQuotaPanel />
        </div>

        <label>
          <span>称呼</span>
          <input
            v-model="assistantName"
            name="assistantName"
            maxlength="24"
            autocomplete="off"
          >
        </label>

        <label>
          <span>MBTI</span>
          <select v-model="mbti" name="mbti">
            <option v-for="item in mbtiOptions" :key="item" :value="item">
              {{ item }}
            </option>
          </select>
        </label>

        <label>
          <span>记忆写入方式</span>
          <select v-model="memoryWriteMode" name="memoryWriteMode">
            <option value="manual">每次确认</option>
            <option value="assisted">重要内容确认</option>
            <option value="auto">自动整理</option>
          </select>
        </label>

        <label>
          <span>作品默认状态</span>
          <select v-model="generatedWorksDefaultVisibility" name="generatedWorksDefaultVisibility">
            <option value="private">默认私密</option>
          </select>
        </label>

        <label>
          <span>不允许记住的内容</span>
          <textarea v-model="disallowedMemoryTopics" name="disallowedMemoryTopics" rows="3" />
        </label>

        <label>
          <span>允许记住的内容</span>
          <textarea v-model="allowedMemoryTopics" name="allowedMemoryTopics" rows="3" />
        </label>

        <div class="profile-settings__checks" aria-label="边界确认">
          <label>
            <input v-model="requireApprovalForPublishing" type="checkbox" name="requireApprovalForPublishing">
            <span>公开作品前确认</span>
          </label>
          <label>
            <input v-model="requireApprovalForPersonaChange" type="checkbox" name="requireApprovalForPersonaChange">
            <span>人格调整前确认</span>
          </label>
          <label>
            <input v-model="requireApprovalForSensitiveMemory" type="checkbox" name="requireApprovalForSensitiveMemory">
            <span>敏感记忆前确认</span>
          </label>
          <label>
            <input v-model="minorMode" type="checkbox" name="minorMode">
            <span>未成年人模式</span>
          </label>
        </div>

        <section class="profile-settings__data">
          <p>数据主权</p>
          <div>
            <button type="button" aria-label="导出聊天记录" :disabled="pending" @click="downloadJson('/api/key/export/chat', 'xingxin-chat-export.json')">
              导出聊天
            </button>
            <button type="button" aria-label="导出记忆" :disabled="pending" @click="downloadJson('/api/key/export/memories', 'xingxin-memories-export.json')">
              导出记忆
            </button>
          </div>
          <label>
            <span>删除确认</span>
            <input v-model="deleteConfirmation" name="deleteConfirmation" autocomplete="off">
          </label>
          <div>
            <button
              type="button"
              aria-label="删除聊天记录"
              :disabled="pending || deleteConfirmation !== 'DELETE'"
              @click="postConfirmedDelete('/api/key/chat/clear', '聊天记录已删除。')"
            >
              删除聊天
            </button>
            <button
              type="button"
              aria-label="清空记忆"
              :disabled="pending || deleteConfirmation !== 'DELETE'"
              @click="postConfirmedDelete('/api/key/memories/clear', '记忆已清空。')"
            >
              清空记忆
            </button>
          </div>
          <small v-if="dataActionMessage">{{ dataActionMessage }}</small>
        </section>

        <button type="submit" :disabled="pending">
          {{ pending ? '正在保存' : '保存设置' }}
        </button>

        <p v-if="error" class="profile-settings__error" role="alert">
          {{ error }}
        </p>
      </form>
    </div>
  </div>
</template>
