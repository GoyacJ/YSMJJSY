<script setup lang="ts">
import {
  layoutNextLineRange,
  materializeLineRange,
  prepareWithSegments,
  type LayoutCursor,
} from '@chenglou/pretext'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { LetterParagraph } from '../content/letter'

type VisualLine = {
  text: string
  x: number
  width: number
}

const props = defineProps<{
  paragraph: LetterParagraph
}>()

const container = ref<HTMLElement | null>(null)
const lines = ref<VisualLine[]>([])
const shouldFallback = ref(true)
let resizeObserver: ResizeObserver | null = null

const lineHeight = 34
const fontFamily = '"Songti SC", "Noto Serif CJK SC", "Microsoft YaHei", sans-serif'

function getLineSlot(layout: NonNullable<LetterParagraph['layout']>, width: number, index: number) {
  if (width < 360 || layout === 'normal') {
    return { x: 0, width }
  }

  if (layout === 'moon-wrap' && index < 3) {
    const offset = Math.max(88, width * 0.22)
    return {
      x: offset,
      width: Math.max(220, width - offset),
    }
  }

  if (layout === 'date-orbit' && index < 4) {
    const stampWidth = Math.min(150, width * 0.34)
    return {
      x: 0,
      width: Math.max(220, width - stampWidth),
    }
  }

  if (layout === 'star-trail') {
    const wave = Math.sin(index * 0.82) * 0.5 + 0.5
    const indent = Math.round(wave * Math.min(92, width * 0.2))
    return {
      x: indent,
      width: Math.max(220, width - indent - Math.min(42, index * 7)),
    }
  }

  return { x: 0, width }
}

function layoutParagraph() {
  const element = container.value

  if (!element) {
    return
  }

  const width = Math.floor(element.getBoundingClientRect().width)

  if (width < 260 || !('Segmenter' in Intl)) {
    shouldFallback.value = true
    lines.value = []
    return
  }

  try {
    const style = window.getComputedStyle(element)
    const fontSize = style.fontSize || '20px'
    const fontWeight = style.fontWeight || '400'
    const letterSpacing = Number.parseFloat(style.letterSpacing)
    const prepared = prepareWithSegments(
      props.paragraph.text,
      `${fontWeight} ${fontSize} ${fontFamily}`,
      {
        letterSpacing: Number.isFinite(letterSpacing) ? letterSpacing : 0,
      },
    )
    const nextLines: VisualLine[] = []
    let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }

    for (let index = 0; index < 32; index += 1) {
      const slot = getLineSlot(props.paragraph.layout ?? 'normal', width, index)
      const range = layoutNextLineRange(prepared, cursor, slot.width)

      if (range === null) {
        break
      }

      const line = materializeLineRange(prepared, range)
      nextLines.push({
        text: line.text,
        x: slot.x,
        width: Math.max(slot.width, line.width),
      })
      cursor = range.end
    }

    lines.value = nextLines
    shouldFallback.value = nextLines.length === 0
  }
  catch {
    shouldFallback.value = true
    lines.value = []
  }
}

onMounted(() => {
  layoutParagraph()

  if (container.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => layoutParagraph())
    resizeObserver.observe(container.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <p
    ref="container"
    class="pretext-paragraph"
    :data-layout="paragraph.layout ?? 'normal'"
    :aria-label="shouldFallback ? undefined : paragraph.text"
  >
    <span
      v-if="paragraph.layout === 'moon-wrap'"
      class="pretext-paragraph__orb pretext-paragraph__orb--moon"
      aria-hidden="true"
    />
    <span
      v-else-if="paragraph.layout === 'date-orbit'"
      class="pretext-paragraph__orb pretext-paragraph__orb--date"
      aria-hidden="true"
    >
      5.20
    </span>
    <span
      v-else-if="paragraph.layout === 'star-trail'"
      class="pretext-paragraph__orb pretext-paragraph__orb--trail"
      aria-hidden="true"
    />

    <span v-if="shouldFallback" class="pretext-paragraph__fallback">
      {{ paragraph.text }}
    </span>
    <span v-else class="pretext-paragraph__lines" aria-hidden="true">
      <span
        v-for="(line, index) in lines"
        :key="`${paragraph.id}-${index}`"
        class="pretext-paragraph__line"
        :style="{ marginLeft: `${line.x}px`, maxWidth: `${line.width}px` }"
      >
        {{ line.text }}
      </span>
    </span>
  </p>
</template>
