<script setup lang="ts">
import { computed } from 'vue'
import type { StarPageDesignSchema } from '../types/design-schema'

const props = defineProps<{
  schema: StarPageDesignSchema
}>()

const visibleSections = computed(() => props.schema.sections.filter((section) => {
  return section.type !== 'star-scene' || !section.caption.includes('每一颗星都可以被重新设计')
}))

function paragraphFor(section: Extract<StarPageDesignSchema['sections'][number], { type: 'letter' }>, index: number) {
  return {
    id: `dynamic-${index}`,
    text: section.text,
    layout: section.layout ?? 'normal',
  }
}
</script>

<template>
  <section
    class="dynamic-star-page"
    :data-theme="schema.theme"
    :data-palette="schema.palette"
    aria-label="钥匙页面"
  >
    <div class="dynamic-star-page__inner">
      <header class="dynamic-star-page__header">
        <p>5.20</p>
        <h1>{{ schema.title }}</h1>
        <span>{{ schema.subtitle }}</span>
      </header>

      <div class="dynamic-star-page__sections">
        <template v-for="(section, index) in visibleSections" :key="`${section.type}-${index}`">
          <article v-if="section.type === 'letter'" class="dynamic-star-page__letter">
            <ClientOnly>
              <PretextParagraph :paragraph="paragraphFor(section, index)" />
              <template #fallback>
                <p class="pretext-paragraph">
                  {{ section.text }}
                </p>
              </template>
            </ClientOnly>
          </article>

          <div v-else-if="section.type === 'memory-map'" class="dynamic-star-page__memory-map">
            <article v-for="(item, itemIndex) in section.items" :key="`${item.date}-${itemIndex}`">
              <span aria-hidden="true" />
              <time>{{ item.date }}</time>
              <p>{{ item.text }}</p>
            </article>
          </div>

          <div
            v-else-if="section.type === 'star-scene'"
            class="dynamic-star-page__star-section"
            :style="{ '--star-density': section.density }"
          >
            <span v-for="star in 18" :key="star" aria-hidden="true" />
            <p>{{ section.caption }}</p>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
