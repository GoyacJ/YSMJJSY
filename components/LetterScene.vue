<script setup lang="ts">
import { finalConfession, letterParagraphs, memoryMoments } from '../content/letter'

const emit = defineEmits<{
  finished: []
}>()
</script>

<template>
  <section class="letter-scene" aria-label="信件正文">
    <div class="letter-scene__folio">
      <div class="letter-scene__sheet">
        <span class="letter-scene__edge-stars" aria-hidden="true" />
        <p class="letter-scene__kicker">
          写给你
        </p>
        <span class="letter-scene__mark" aria-hidden="true">5.20</span>

        <div class="letter-scene__paragraphs">
          <ClientOnly>
            <PretextParagraph
              v-for="paragraph in letterParagraphs"
              :key="paragraph.id"
              :paragraph="paragraph"
            />
            <template #fallback>
              <p
                v-for="paragraph in letterParagraphs"
                :key="paragraph.id"
                class="pretext-paragraph"
              >
                {{ paragraph.text }}
              </p>
            </template>
          </ClientOnly>
        </div>

        <div class="letter-scene__star-map" aria-label="记忆星图">
          <article v-for="(moment, index) in memoryMoments" :key="moment.id" class="letter-scene__moment">
            <span class="letter-scene__star" aria-hidden="true" />
            <time>{{ moment.date }} / RA 05:{{ 20 + index }}</time>
            <p>{{ moment.text }}</p>
          </article>
        </div>

        <footer class="letter-scene__final">
          <h2>{{ finalConfession.title }}</h2>
          <p>{{ finalConfession.subtitle }}</p>
          <button type="button" @click="emit('finished')">
            去看星空
          </button>
        </footer>
      </div>
    </div>
  </section>
</template>
