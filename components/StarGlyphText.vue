<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  text: string
  role: 'user' | 'assistant'
}>()

const glyphs = computed(() => Array.from(props.text))

function getDelay(index: number) {
  const base = props.role === 'user' ? 28 : 18
  return `${index * base}ms`
}
</script>

<template>
  <span class="star-glyph-text" :data-role="role">
    <span
      v-for="(glyph, index) in glyphs"
      :key="`${index}-${glyph}`"
      class="star-glyph-text__glyph"
      :style="{ '--glyph-delay': getDelay(index) }"
    >{{ glyph }}</span>
  </span>
</template>
