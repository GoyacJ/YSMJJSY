<script setup lang="ts">
import { finalConfession, letterParagraphs, memoryMoments } from '../content/letter'
</script>

<template>
  <section class="letter-scene" aria-label="信件正文">
    <div class="letter-scene__paper">
      <p class="letter-scene__kicker">
        写给你
      </p>

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

      <div class="letter-scene__moments">
        <article v-for="moment in memoryMoments" :key="moment.id">
          <time>{{ moment.date }}</time>
          <p>{{ moment.text }}</p>
        </article>
      </div>

      <footer class="letter-scene__final">
        <h2>{{ finalConfession.title }}</h2>
        <p>{{ finalConfession.subtitle }}</p>
      </footer>
    </div>
  </section>
</template>
