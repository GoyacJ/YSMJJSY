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
const mode = ref<'enter' | 'create'>('enter')
const pending = ref(false)
const error = ref('')

async function submit() {
  pending.value = true
  error.value = ''

  try {
    const result = mode.value === 'create'
      ? await props.createKey(code.value)
      : await props.unlock(code.value)

    if (result.ok) {
      emit(mode.value === 'create' ? 'created' : 'unlocked', result)
      return
    }

    error.value = mode.value === 'create'
      ? '这把钥匙暂时不能保存。'
      : '这不是这封信的钥匙。'
  }
  finally {
    pending.value = false
  }
}

function switchMode(nextMode: 'enter' | 'create') {
  mode.value = nextMode
  code.value = ''
  error.value = ''
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
          autocomplete="off"
          maxlength="64"
          :placeholder="mode === 'create' ? '写下新钥匙' : '输入钥匙'"
          class="unlock-gate__code-line"
        >
        <button
          type="button"
          :disabled="pending"
          :aria-label="mode === 'create' ? '保存钥匙' : '打开这封信'"
          @click="submit"
        >
          {{ pending ? '请稍等' : mode === 'create' ? '保存钥匙' : '打开这封信' }}
        </button>
      </form>

      <div class="unlock-gate__mode-actions">
        <button
          v-if="mode === 'enter'"
          type="button"
          aria-label="创建钥匙"
          @click="switchMode('create')"
        >
          创建钥匙
        </button>
        <button
          v-else
          type="button"
          aria-label="返回输入"
          @click="switchMode('enter')"
        >
          返回输入
        </button>
      </div>

      <p v-if="error" class="unlock-gate__error" role="alert">
        {{ error }}
      </p>
    </div>
  </section>
</template>
