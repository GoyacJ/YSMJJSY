<script setup lang="ts">
import { ref } from 'vue'
import { useStarChat, type StarChatMessage, type StarChatReply } from '../composables/useStarChat'

const props = defineProps<{
  sendMessage?: (message: string) => Promise<StarChatReply>
}>()

const input = ref('')
const pending = ref(false)
const error = ref('')
const localMessages = ref<StarChatMessage[]>([])
const chat = useStarChat()

async function submit() {
  const text = input.value.trim()

  if (!text || pending.value) {
    return
  }

  pending.value = true
  error.value = ''
  localMessages.value.push({ role: 'user', content: text })
  input.value = ''

  try {
    const result = props.sendMessage
      ? await props.sendMessage(text)
      : await chat.sendMessage(text)

    if (result.reply) {
      localMessages.value.push({ role: 'assistant', content: result.reply })
    }
  }
  catch {
    error.value = '星信刚刚走神了，等一下再试。'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <aside class="star-chat" aria-label="星信">
    <header>
      <p>星信</p>
      <span>这封信里的星光</span>
    </header>

    <div class="star-chat__messages" aria-live="polite">
      <p v-if="localMessages.length === 0" class="star-chat__empty">
        你可以问这封信里的任何一句话。
      </p>
      <article
        v-for="(message, index) in localMessages"
        :key="`${message.role}-${index}`"
        :data-role="message.role"
      >
        {{ message.content }}
      </article>
    </div>

    <form @submit.prevent="submit">
      <label class="sr-only" for="star-chat-input">和星信说话</label>
      <textarea
        id="star-chat-input"
        v-model="input"
        rows="2"
        placeholder="和星信说句话"
      />
      <button type="submit" :disabled="pending">
        {{ pending ? '等待星信' : '发送' }}
      </button>
    </form>

    <p v-if="error" class="star-chat__error" role="alert">
      {{ error }}
    </p>

    <MediaCreationPanel :source-text="localMessages.at(-1)?.content || '这封信里的星光'" />
  </aside>
</template>
