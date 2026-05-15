<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { finalConfession } from '../content/letter'
import { create520StarPoints } from '../utils/star-map'

const canvas = ref<HTMLCanvasElement | null>(null)
let frame = 0
let animationFrame = 0

function draw() {
  const element = canvas.value

  if (!element) {
    return
  }

  const context = element.getContext('2d')

  if (!context) {
    return
  }

  const rect = element.getBoundingClientRect()
  const ratio = window.devicePixelRatio || 1
  const width = Math.max(320, rect.width)
  const height = Math.max(420, rect.height)

  element.width = Math.round(width * ratio)
  element.height = Math.round(height * ratio)
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, width, height)

  const gradient = context.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, '#111a35')
  gradient.addColorStop(1, '#24182f')
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)

  const points = create520StarPoints({ width, height })
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const shimmer = prefersReducedMotion ? 0 : Math.sin(frame / 36) * 0.22

  context.strokeStyle = `rgba(255, 235, 190, ${0.22 + shimmer})`
  context.lineWidth = 1
  context.beginPath()
  points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y)
      return
    }

    context.lineTo(point.x, point.y)
  })
  context.stroke()

  for (const point of points) {
    context.beginPath()
    context.fillStyle = 'rgba(255, 246, 218, 0.92)'
    context.shadowColor = 'rgba(255, 224, 167, 0.8)'
    context.shadowBlur = 10
    context.arc(point.x, point.y, 2.4, 0, Math.PI * 2)
    context.fill()
  }

  context.shadowBlur = 0
  frame += 1

  if (!prefersReducedMotion) {
    animationFrame = window.requestAnimationFrame(draw)
  }
}

function resize() {
  window.cancelAnimationFrame(animationFrame)
  animationFrame = window.requestAnimationFrame(draw)
}

onMounted(() => {
  draw()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.cancelAnimationFrame(animationFrame)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <section class="star-scene" aria-label="星空告白">
    <canvas ref="canvas" class="star-scene__canvas" aria-hidden="true" />
    <div class="star-scene__entry-glow" aria-hidden="true" />
    <div class="star-scene__content">
      <p class="star-scene__kicker">
        5.20
      </p>
      <h2>{{ finalConfession.title }}</h2>
      <p>{{ finalConfession.subtitle }}</p>
    </div>
  </section>
</template>
