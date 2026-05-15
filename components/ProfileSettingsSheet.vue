<script setup lang="ts">
import { ref } from 'vue'

type ProfileUpdate = {
  assistantName: string
  mbti: string
}

type ProfileResult = ProfileUpdate & {
  keyId: string
  configured: boolean
}

const props = defineProps<{
  loadProfile?: () => Promise<ProfileResult>
  saveProfile?: (input: ProfileUpdate) => Promise<ProfileResult>
}>()

const emit = defineEmits<{
  updated: [profile: ProfileResult]
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

const open = ref(false)
const assistantName = ref('星信')
const mbti = ref('INTJ')
const pending = ref(false)
const error = ref('')

async function defaultLoadProfile() {
  return await $fetch<ProfileResult>('/api/key/profile')
}

async function defaultSaveProfile(input: ProfileUpdate) {
  return await $fetch<ProfileResult>('/api/key/profile', {
    method: 'PUT',
    body: input,
  })
}

async function openSettings() {
  open.value = true
  pending.value = true
  error.value = ''

  try {
    const profile = props.loadProfile ? await props.loadProfile() : await defaultLoadProfile()
    assistantName.value = profile.assistantName || '星信'
    mbti.value = profile.mbti || 'INTJ'
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
    }
    const profile = props.saveProfile ? await props.saveProfile(input) : await defaultSaveProfile(input)
    emit('updated', profile)
    open.value = false
  }
  catch {
    error.value = '设置没有保存成功。'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="profile-settings">
    <button
      type="button"
      class="profile-settings__trigger"
      aria-label="打开设置"
      @click="openSettings"
    >
      设
    </button>

    <div v-if="open" class="profile-settings__sheet" role="dialog" aria-label="星信设置">
      <form class="profile-settings__panel" @submit.prevent="submit">
        <header>
          <p>设置</p>
          <button type="button" aria-label="关闭设置" @click="open = false">
            关
          </button>
        </header>

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
