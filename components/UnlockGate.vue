<script setup lang="ts">
import { ref } from 'vue'

type UnlockResult = {
  ok: boolean
}

const props = defineProps<{
  unlock: (code: string) => Promise<UnlockResult>
}>()

const emit = defineEmits<{
  unlocked: []
}>()

const code = ref('')
const pending = ref(false)
const error = ref('')

async function submit() {
  pending.value = true
  error.value = ''

  try {
    const result = await props.unlock(code.value)

    if (result.ok) {
      emit('unlocked')
      return
    }

    error.value = '这不是这封信的钥匙。'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="unlock-gate" aria-label="打开这封信">
    <div class="unlock-gate__paper">
      <p class="unlock-gate__date">
        5.20
      </p>
      <h1>给你的信</h1>
      <p class="unlock-gate__copy">
        有些话放在心里很久，今天想认真写给你。
      </p>

      <form class="unlock-gate__form" @submit.prevent="submit">
        <label class="sr-only" for="unlock-code">密码</label>
        <input
          id="unlock-code"
          v-model="code"
          inputmode="numeric"
          autocomplete="off"
          maxlength="12"
          placeholder="输入钥匙"
        >
        <button type="submit" :disabled="pending">
          {{ pending ? '正在打开' : '打开这封信' }}
        </button>
      </form>

      <p v-if="error" class="unlock-gate__error" role="alert">
        {{ error }}
      </p>
    </div>
  </section>
</template>
