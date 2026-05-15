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
const pending = ref(false)
const error = ref('')

async function defaultSaveProfile(input: ProfileUpdate) {
  return await $fetch<ProfileResult>('/api/key/profile', {
    method: 'PUT',
    body: input,
  })
}

async function submit() {
  pending.value = true
  error.value = ''

  try {
    const result = props.saveProfile
      ? await props.saveProfile({
          assistantName: assistantName.value.trim(),
          mbti: mbti.value,
        })
      : await defaultSaveProfile({
          assistantName: assistantName.value.trim(),
          mbti: mbti.value,
        })

    emit('configured', result)
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

      <button type="submit" :disabled="pending">
        {{ pending ? '正在保存' : '保存设定' }}
      </button>

      <p v-if="error" class="key-setup__error" role="alert">
        {{ error }}
      </p>
    </form>
  </section>
</template>
