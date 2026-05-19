<script setup lang="ts">
import { ref } from 'vue'
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
  saveProfile?: (input: ProfileUpdate) => Promise<ProfileResult>
}>()

const emit = defineEmits<{
  configured: [profile: ProfileResult]
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

async function defaultSaveProfile(input: ProfileUpdate) {
  return await $fetch<ProfileResult>('/api/key/profile', {
    method: 'PUT',
    headers: withCsrfHeaders(),
    body: input,
  })
}

async function submit() {
  pending.value = true
  error.value = ''

  try {
    const result = props.saveProfile
      ? await props.saveProfile(buildProfileUpdate())
      : await defaultSaveProfile(buildProfileUpdate())

    emit('configured', result)
  }
  catch {
    error.value = '设置没有保存成功。'
  }
  finally {
    pending.value = false
  }
}

function parseTopicList(value: string) {
  return value
    .split(/\n|,/)
    .map(item => item.trim())
    .filter(Boolean)
}

function buildProfileUpdate(): ProfileUpdate {
  return {
    assistantName: assistantName.value.trim(),
    mbti: mbti.value,
    boundarySettings: {
      memoryWriteMode: memoryWriteMode.value,
      generatedWorksDefaultVisibility: 'private',
      requireApprovalForPublishing: requireApprovalForPublishing.value,
      requireApprovalForPersonaChange: requireApprovalForPersonaChange.value,
      requireApprovalForSensitiveMemory: requireApprovalForSensitiveMemory.value,
      disallowedMemoryTopics: parseTopicList(disallowedMemoryTopics.value),
      allowedMemoryTopics: parseTopicList(allowedMemoryTopics.value),
      minorMode: minorMode.value,
    },
  }
}
</script>

<template>
  <section class="key-setup" aria-label="星信设定">
    <form class="key-setup__panel" @submit.prevent="submit">
      <p class="key-setup__kicker">
        第一次见面
      </p>
      <h1>设定这把钥匙里的星信</h1>

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
        <textarea
          v-model="disallowedMemoryTopics"
          name="disallowedMemoryTopics"
          rows="3"
          placeholder="一行一个"
        />
      </label>

      <label>
        <span>允许记住的内容</span>
        <textarea
          v-model="allowedMemoryTopics"
          name="allowedMemoryTopics"
          rows="3"
          placeholder="一行一个"
        />
      </label>

      <div class="key-setup__checks" aria-label="边界确认">
        <label>
          <input v-model="requireApprovalForPublishing" type="checkbox" name="requireApprovalForPublishing">
          <span>公开作品前确认</span>
        </label>
        <label>
          <input v-model="requireApprovalForPersonaChange" type="checkbox" name="requireApprovalForPersonaChange">
          <span>调整语气和关系前确认</span>
        </label>
        <label>
          <input v-model="requireApprovalForSensitiveMemory" type="checkbox" name="requireApprovalForSensitiveMemory">
          <span>写入敏感记忆前确认</span>
        </label>
        <label>
          <input v-model="minorMode" type="checkbox" name="minorMode">
          <span>未成年人模式</span>
        </label>
      </div>

      <button type="submit" :disabled="pending">
        {{ pending ? '正在保存' : '保存设定' }}
      </button>

      <p v-if="error" class="key-setup__error" role="alert">
        {{ error }}
      </p>
    </form>
  </section>
</template>
