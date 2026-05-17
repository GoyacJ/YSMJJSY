<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import StarGlyphText from './StarGlyphText.vue'
import StarSpectralMedia from './StarSpectralMedia.vue'
import type { StarChatMessage, StarChatPart } from '../composables/useStarChat'

type OrbitMood = 'new-moon' | 'half-moon' | 'full-moon' | 'meteor' | 'nebula'

type OrbitGroup = {
  id: string
  userMessage?: StarChatMessage
  userIndex?: number
  assistantMessage?: StarChatMessage
  assistantIndex?: number
  position: { x: number; y: number }
  mood: OrbitMood
  memoryLabel: string
}

const props = defineProps<{
  messages: StarChatMessage[]
  activeMessageIndex: number | null
}>()

const emit = defineEmits<{
  copy: [message: StarChatMessage]
  activate: [index: number]
  interact: []
}>()

const activeMemoryId = ref<string | null>(null)
const visibleGroupLimit = 2

const groups = computed(() => {
  const nextGroups: OrbitGroup[] = []

  for (let index = 0; index < props.messages.length; index += 1) {
    const message = props.messages[index]

    if (message.role !== 'user') {
      nextGroups.push({
        id: `${index}`,
        assistantMessage: message,
        assistantIndex: index,
        position: getOrbitPosition(nextGroups.length),
        mood: getOrbitMood(message),
        memoryLabel: getMemoryLabel(undefined, message),
      })
      continue
    }

    const possibleAssistant = props.messages[index + 1]
    const assistantMessage = possibleAssistant?.role === 'assistant' ? possibleAssistant : undefined
    const groupIndex = nextGroups.length

    nextGroups.push({
      id: `${index}-${assistantMessage ? index + 1 : 'pending'}`,
      userMessage: message,
      userIndex: index,
      assistantMessage,
      assistantIndex: assistantMessage ? index + 1 : undefined,
      position: getOrbitPosition(groupIndex),
      mood: getOrbitMood(assistantMessage),
      memoryLabel: getMemoryLabel(message, assistantMessage),
    })

    if (assistantMessage) {
      index += 1
    }
  }

  return nextGroups
})

const visibleGroups = computed(() => groups.value.slice(-visibleGroupLimit))
const activeMemory = computed(() => groups.value.find(group => group.id === activeMemoryId.value))

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})

function hasMedia(message?: StarChatMessage) {
  return Boolean(message?.parts?.some(part => ['audio', 'image', 'music', 'video'].includes(part.type)))
}

function getOrbitPosition(index: number) {
  const positions = [
    { x: 18, y: 18 },
    { x: 82, y: 22 },
    { x: 24, y: 54 },
    { x: 74, y: 50 },
    { x: 38, y: 82 },
    { x: 88, y: 74 },
  ]

  return positions[index % positions.length]
}

function getOrbitMood(message?: StarChatMessage): OrbitMood {
  if (hasMedia(message)) {
    return 'nebula'
  }

  const length = message?.content.length ?? 0

  if (length > 72) {
    return 'full-moon'
  }

  if (length > 0 && length <= 12) {
    return 'meteor'
  }

  if (length > 0 && length <= 28) {
    return 'new-moon'
  }

  return 'half-moon'
}

function getMemoryLabel(userMessage?: StarChatMessage, assistantMessage?: StarChatMessage) {
  const sourceMessage = userMessage ?? assistantMessage

  if (hasPartType(userMessage, 'image') || hasPartType(assistantMessage, 'image')) {
    return '图像记忆'
  }

  if (hasPartType(userMessage, 'audio') || hasPartType(assistantMessage, 'audio')) {
    return '声音记忆'
  }

  if (hasPartType(assistantMessage, 'music')) {
    return '旋律记忆'
  }

  if (hasPartType(userMessage, 'video') || hasPartType(assistantMessage, 'video')) {
    return '影像记忆'
  }

  return (sourceMessage?.content ?? '一段星信').slice(0, 12).replace(/[，。！？,.!?]+$/u, '')
}

function hasPartType(message: StarChatMessage | undefined, type: StarChatPart['type']) {
  return Boolean(message?.parts?.some(part => part.type === type))
}

function getTextParts(message: StarChatMessage | undefined) {
  const parts = message?.parts?.filter(part => part.type === 'text' || part.type === 'status') ?? []
  return parts.length ? parts : message?.content ? [{ type: 'text' as const, text: message.content }] : []
}

function getMediaParts(message: StarChatMessage | undefined) {
  return message?.parts?.filter((part): part is Extract<StarChatPart, { type: 'audio' | 'image' | 'music' | 'video' }> => ['audio', 'image', 'music', 'video'].includes(part.type)) ?? []
}

function getGroupStyle(group: OrbitGroup) {
  return {
    '--orbit-x': `${group.position.x}%`,
    '--orbit-y': `${group.position.y}%`,
  }
}

function getVisibleGroupStyle(index: number, total: number) {
  const positions = total <= 1
    ? [{ x: 58, y: 56 }]
    : [
        { x: 31, y: 40 },
        { x: 66, y: 56 },
      ]
  const position = positions[index] ?? positions.at(-1) ?? { x: 58, y: 66 }

  return {
    '--orbit-x': `${position.x}%`,
    '--orbit-y': `${position.y}%`,
  }
}

function isGroupActive(group: OrbitGroup) {
  return props.activeMessageIndex === group.userIndex || props.activeMessageIndex === group.assistantIndex || activeMemoryId.value === group.id
}

function activateGroup(group: OrbitGroup) {
  emit('activate', group.assistantIndex ?? group.userIndex ?? 0)
}

function toggleMemory(group: OrbitGroup) {
  activeMemoryId.value = activeMemoryId.value === group.id ? null : group.id
  activateGroup(group)
}

function closeMemory() {
  activeMemoryId.value = null
}

function handleStageClick() {
  emit('interact')
  closeMemory()
}

function handleDocumentClick() {
  closeMemory()
}

function copyGroupMessage(group: OrbitGroup) {
  const message = group.assistantMessage ?? group.userMessage

  if (message) {
    emit('copy', message)
  }
}
</script>

<template>
  <section
    class="star-orbit-stage"
    aria-label="星轨共写"
    @click="handleStageClick"
    @touchstart.passive="emit('interact')"
  >
    <div class="star-orbit-stage__field star-chat__messages" aria-live="polite">
      <svg class="star-orbit-stage__path" viewBox="0 0 100 100" aria-hidden="true">
        <path d="M48 76 C32 64 31 46 44 38 S68 41 70 59 53 78 34 58" />
      </svg>

      <article
        v-for="(group, visibleIndex) in visibleGroups"
        :key="group.id"
        class="star-orbit-group"
        :class="{
          'star-orbit-group--active': isGroupActive(group),
          'star-orbit-group--latest': visibleIndex === visibleGroups.length - 1,
          'star-orbit-group--memory-preview': visibleIndex < visibleGroups.length - 1,
        }"
        :data-mood="group.mood"
        :style="getVisibleGroupStyle(visibleIndex, visibleGroups.length)"
        @click.stop="activateGroup(group)"
      >
        <div class="star-orbit-group__trail" aria-hidden="true" />
        <div v-if="group.userMessage" class="star-orbit-group__user">
          <template v-for="(part, partIndex) in getTextParts(group.userMessage)" :key="`user-${partIndex}`">
            <StarGlyphText
              v-if="part.type === 'text'"
              :text="part.text"
              role="user"
            />
            <span v-else class="star-orbit-group__status">{{ part.text }}</span>
          </template>
        </div>

        <div v-if="group.assistantMessage" class="star-orbit-group__assistant">
          <span class="star-orbit-group__core" aria-hidden="true" />
          <template v-for="(part, partIndex) in getTextParts(group.assistantMessage)" :key="`assistant-${partIndex}`">
            <StarGlyphText
              v-if="part.type === 'text'"
              :text="part.text"
              role="assistant"
            />
            <span v-else class="star-orbit-group__status">{{ part.text }}</span>
          </template>
          <div v-if="getMediaParts(group.assistantMessage).length" class="star-orbit-group__media">
            <StarSpectralMedia
              v-for="(part, partIndex) in getMediaParts(group.assistantMessage)"
              :key="`media-${partIndex}`"
              :part="part"
            />
          </div>
        </div>

        <button
          type="button"
          class="star-orbit-group__copy"
          aria-label="复制消息"
          @click.stop="copyGroupMessage(group)"
        >
          复制
        </button>
      </article>

      <div v-if="groups.length" class="star-memory-constellation" aria-label="记忆星座">
        <button
          v-for="group in groups"
          :key="`memory-${group.id}`"
          type="button"
          class="star-memory-constellation__star"
          :class="{ 'star-memory-constellation__star--active': activeMemoryId === group.id }"
          :style="getGroupStyle(group)"
          :aria-label="`回看记忆：${group.memoryLabel}`"
          @click.stop="toggleMemory(group)"
        >
          <span aria-hidden="true" />
        </button>
      </div>

      <Transition name="star-memory-popover">
        <aside v-if="activeMemory" class="star-memory-popover" role="dialog" aria-label="记忆回看" @click.stop>
          <button type="button" class="star-memory-popover__close" aria-label="关闭记忆回看" @click="closeMemory">
            ×
          </button>
          <p class="star-memory-popover__label">{{ activeMemory.memoryLabel }}</p>
          <p v-if="activeMemory.userMessage">{{ activeMemory.userMessage.content }}</p>
          <p v-if="activeMemory.assistantMessage">{{ activeMemory.assistantMessage.content }}</p>
          <button
            v-if="activeMemory.assistantMessage"
            type="button"
            class="star-memory-popover__copy"
            @click="emit('copy', activeMemory.assistantMessage)"
          >
            复制
          </button>
        </aside>
      </Transition>
    </div>
  </section>
</template>
