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
  createKey: (code: string) => Promise<UnlockResult>
}>()

const emit = defineEmits<{
  unlocked: [result: UnlockResult]
  created: [result: UnlockResult]
}>()

const code = ref('')
const pending = ref(false)
const error = ref('')

async function submitUnlock() {
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

async function submitCreate() {
  pending.value = true
  error.value = ''

  if (code.value.trim().length < 6) {
    error.value = '钥匙至少需要 6 位。'
    pending.value = false
    return
  }

  try {
    const result = await props.createKey(code.value)

    if (result.ok) {
      emit('created', result)
      return
    }

    error.value = '这把钥匙暂时不能保存。'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="unlock-gate" aria-label="钥匙入口">
    <div class="unlock-gate__panel">
      <form class="unlock-gate__form" @submit.prevent="submitUnlock">
        <label class="sr-only" for="unlock-code">密码</label>
        <input
          id="unlock-code"
          v-model="code"
          autocomplete="off"
          maxlength="64"
          minlength="6"
          placeholder="输入钥匙"
          class="unlock-gate__code-line"
        >
        <button
          class="unlock-gate__enter"
          type="button"
          :disabled="pending || !code.trim()"
          aria-label="进入"
          @click="submitUnlock"
        >
          {{ pending ? '请稍等' : '进入' }}
        </button>
        <button
          class="unlock-gate__create"
          type="button"
          :disabled="pending"
          aria-label="创建钥匙"
          @click="submitCreate"
        >
          创建钥匙
        </button>
      </form>

      <p v-if="error" class="unlock-gate__error" role="alert">
        {{ error }}
      </p>
    </div>
  </section>
</template>
