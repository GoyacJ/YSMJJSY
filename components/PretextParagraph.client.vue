<script setup lang="ts">
import type { LetterParagraph } from '../content/letter'

defineProps<{
  paragraph: LetterParagraph
}>()
</script>

<template>
  <p class="pretext-paragraph" :data-layout="paragraph.layout ?? 'normal'">
    <span v-if="paragraph.layout === 'heart-wrap'" class="pretext-paragraph__shape">♡</span>
    <span v-else-if="paragraph.layout === 'date-wrap'" class="pretext-paragraph__shape">5.20</span>
    {{ paragraph.text }}
  </p>
</template>
