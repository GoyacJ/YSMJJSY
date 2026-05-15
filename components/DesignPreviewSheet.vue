<script setup lang="ts">
import type { StarPageDesignSchema } from '../types/design-schema'

defineProps<{
  schema: StarPageDesignSchema
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <section class="design-preview-sheet" aria-label="设计预览">
    <div class="design-preview-sheet__panel">
      <div class="design-preview-sheet__preview">
        <DynamicStarPage :schema="schema" />
      </div>
      <div class="design-preview-sheet__actions">
        <button type="button" aria-label="放弃" @click="emit('cancel')">
          放弃
        </button>
        <button type="button" aria-label="保存这个设计" @click="emit('confirm')">
          保存这个设计
        </button>
      </div>
    </div>
  </section>
</template>
