<script setup lang="ts">
import { ref } from 'vue'

type UnlockResult = {
  ok: boolean
  keyId?: string
  needsConfig?: boolean
  message?: string
}

const props = defineProps<{
  unlock: (code: string) => Promise<UnlockResult>
}>()

const emit = defineEmits<{
  unlocked: [result: UnlockResult]
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
      emit('unlocked', result)
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
    <div class="unlock-gate__envelope">
      <div class="unlock-gate__flap" aria-hidden="true" />
      <div class="unlock-gate__stamp" aria-hidden="true">
        5.20
      </div>
      <div class="unlock-gate__letter-head">
        <p class="unlock-gate__date">
          只给你
        </p>
        <h1>给你的信</h1>
        <p class="unlock-gate__copy">
          有些话放在心里很久，今天想认真写给你。
        </p>
      </div>

      <form class="unlock-gate__form" @submit.prevent="submit">
        <label class="sr-only" for="unlock-code">密码</label>
        <input
          id="unlock-code"
          v-model="code"
          inputmode="numeric"
          autocomplete="off"
          maxlength="12"
          placeholder="输入钥匙"
          class="unlock-gate__code-line"
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
