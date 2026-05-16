<script setup lang="ts">
import { layoutWithLines, prepareWithSegments } from '@chenglou/pretext'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  createFlyingBirdEntities,
  createPublicStarEntities,
  resolveSceneMode,
  type PublicStar,
  type PublicStarEntity,
  type PublicStarSceneMode,
} from '../utils/public-star-scene'

const props = withDefaults(defineProps<{
  stars: PublicStar[]
  flashIds?: string[]
}>(), {
  flashIds: () => [],
})

type CachedLabel = {
  lines: Array<{ text: string, width: number }>
  width: number
  height: number
}

type LabelRect = {
  x: number
  y: number
  width: number
  height: number
}

const canvas = ref<HTMLCanvasElement | null>(null)
const mode = ref<PublicStarSceneMode>('galaxy')
const isReducedMotion = ref(false)
const entryEvent = ref<{ id: string, name: string, startedAt: number } | null>(null)
const flashes = new Map<string, number>()
const labelCache = new Map<string, CachedLabel>()
const sceneMode = computed(() => mode.value)
const entryEventKey = 'ysmjjsy:new-public-star'

let animationFrame = 0
let darkQuery: MediaQueryList | null = null
let reducedMotionQuery: MediaQueryList | null = null

function getCanvasContext() {
  const element = canvas.value

  if (window.navigator.userAgent.includes('jsdom')) {
    return null
  }

  if (!element || typeof element.getContext !== 'function') {
    return null
  }

  try {
    return element.getContext('2d')
  }
  catch {
    return null
  }
}

function resizeCanvas(element: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const rect = element.getBoundingClientRect()
  const ratio = window.devicePixelRatio || 1
  const width = Math.max(320, rect.width || window.innerWidth || 320)
  const height = Math.max(420, rect.height || window.innerHeight || 420)

  if (element.width !== Math.round(width * ratio) || element.height !== Math.round(height * ratio)) {
    element.width = Math.round(width * ratio)
    element.height = Math.round(height * ratio)
  }

  context.setTransform(ratio, 0, 0, ratio, 0, 0)

  return { width, height }
}

function drawGalaxyBackground(context: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const gradient = context.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, '#07111f')
  gradient.addColorStop(0.48, '#11183a')
  gradient.addColorStop(1, '#24172d')
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)

  context.save()
  context.translate(width * 0.5, height * 0.48)
  context.rotate(-0.18)
  const band = context.createLinearGradient(-width * 0.48, 0, width * 0.48, 0)
  band.addColorStop(0, 'rgb(255 255 255 / 0)')
  band.addColorStop(0.5, 'rgb(173 202 255 / 0.16)')
  band.addColorStop(1, 'rgb(255 255 255 / 0)')
  context.fillStyle = band
  context.fillRect(-width * 0.62, -height * 0.13, width * 1.24, height * 0.26)
  context.restore()

  for (let index = 0; index < 110; index += 1) {
    const x = (index * 89) % width
    const y = (index * 157) % height
    const pulse = isReducedMotion.value ? 0.65 : 0.48 + Math.sin(time / 900 + index) * 0.24
    context.fillStyle = `rgb(255 248 222 / ${pulse})`
    context.beginPath()
    context.arc(x, y, index % 9 === 0 ? 1.7 : 0.9, 0, Math.PI * 2)
    context.fill()
  }
}

function drawSkyBackground(context: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const gradient = context.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, '#7ec8ff')
  gradient.addColorStop(0.58, '#d9f0ff')
  gradient.addColorStop(1, '#fff7df')
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)

  context.fillStyle = 'rgb(255 255 255 / 0.68)'
  for (let index = 0; index < 7; index += 1) {
    const drift = isReducedMotion.value ? 0 : Math.sin(time / 1800 + index) * 16
    const x = ((index * 211) % Math.round(width + 180)) - 90 + drift
    const y = height * (0.16 + (index % 3) * 0.13)

    context.beginPath()
    context.ellipse(x, y, 82, 22, 0, 0, Math.PI * 2)
    context.ellipse(x + 58, y + 3, 64, 19, 0, 0, Math.PI * 2)
    context.ellipse(x - 52, y + 5, 52, 16, 0, 0, Math.PI * 2)
    context.fill()
  }
}

function getLabelLayout(context: CanvasRenderingContext2D, label: string, font: string): CachedLabel {
  const key = `${font}\n${label}`
  const cached = labelCache.get(key)

  if (cached) {
    return cached
  }

  try {
    const prepared = prepareWithSegments(label, font, { letterSpacing: 0 })
    const result = layoutWithLines(prepared, 140, 22)
    const lines = result.lines.map(line => ({ text: line.text, width: line.width }))
    const layout = {
      lines,
      width: Math.max(1, ...lines.map(line => line.width)),
      height: Math.max(22, result.height),
    }
    labelCache.set(key, layout)
    return layout
  }
  catch {
    const width = context.measureText(label).width
    const layout = {
      lines: [{ text: label, width }],
      width,
      height: 22,
    }
    labelCache.set(key, layout)
    return layout
  }
}

function getFlashAlpha(entity: PublicStarEntity, time: number) {
  const startedAt = flashes.get(entity.id)

  if (!startedAt) {
    return 0
  }

  const elapsed = time - startedAt

  if (elapsed > 1200) {
    flashes.delete(entity.id)
    return 0
  }

  return 1 - elapsed / 1200
}

function drawGalaxyStar(context: CanvasRenderingContext2D, entity: PublicStarEntity, time: number) {
  const pulse = isReducedMotion.value ? 0.55 : 0.55 + Math.sin(time / 520 + entity.seed) * 0.22
  const flash = getFlashAlpha(entity, time)

  context.save()
  context.shadowColor = `rgb(255 230 165 / ${0.38 + flash * 0.55})`
  context.shadowBlur = 14 + flash * 28
  context.fillStyle = `rgb(255 247 219 / ${0.82 + pulse * 0.16})`
  context.beginPath()
  context.arc(entity.x, entity.y, 2.2 + flash * 2.4, 0, Math.PI * 2)
  context.fill()

  context.globalAlpha = 0.24 + flash * 0.45
  context.strokeStyle = '#ffe9ad'
  context.beginPath()
  context.arc(entity.x, entity.y, 13 + flash * 16, 0, Math.PI * 2)
  context.stroke()
  context.restore()
}

function drawSkyBird(context: CanvasRenderingContext2D, entity: PublicStarEntity, time: number) {
  const flap = isReducedMotion.value ? 0.22 : Math.sin(time / 280 + entity.seed) * 0.38
  const flash = getFlashAlpha(entity, time)

  context.save()
  context.translate(entity.x, entity.y)
  context.strokeStyle = `rgb(24 77 117 / ${0.64 + flash * 0.3})`
  context.lineWidth = 2
  context.lineCap = 'round'
  context.shadowColor = `rgb(255 247 184 / ${flash * 0.85})`
  context.shadowBlur = flash * 24
  context.beginPath()
  context.moveTo(-13, 0)
  context.quadraticCurveTo(-5, -7 - flap * 8, 0, 0)
  context.quadraticCurveTo(7, -7 + flap * 6, 14, 0)
  context.stroke()

  if (flash > 0) {
    context.globalAlpha = flash * 0.34
    context.fillStyle = '#fff3a6'
    context.beginPath()
    context.arc(0, 0, 18 + flash * 16, 0, Math.PI * 2)
    context.fill()
  }

  context.restore()
}

function intersects(a: LabelRect, b: LabelRect) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y
}

function drawLabel(
  context: CanvasRenderingContext2D,
  entity: PublicStarEntity,
  currentMode: PublicStarSceneMode,
  occupied?: LabelRect[],
) {
  const font = '500 18px "LXGW WenKai", "Songti SC", "Microsoft YaHei", sans-serif'
  const ratio = window.devicePixelRatio || 1
  const canvasWidth = context.canvas.width / ratio
  context.font = font
  context.textBaseline = 'top'
  context.textAlign = 'left'
  context.shadowBlur = currentMode === 'galaxy' ? 8 : 0
  context.shadowColor = 'rgb(255 240 190 / 0.45)'
  context.fillStyle = currentMode === 'galaxy'
    ? 'rgb(255 246 220 / 0.92)'
    : 'rgb(26 68 104 / 0.76)'

  const layout = getLabelLayout(context, entity.label, font)
  const x = Math.min(Math.max(18, entity.x + 12), Math.max(18, canvasWidth - layout.width - 18))
  const y = entity.y + (currentMode === 'galaxy' ? 10 : 14)
  const rect = {
    x,
    y,
    width: layout.width + 10,
    height: layout.height + 4,
  }

  if (occupied?.some(item => intersects(rect, item))) {
    context.shadowBlur = 0
    return
  }

  for (const [index, line] of layout.lines.entries()) {
    context.fillText(line.text, x, y + index * 22)
  }
  occupied?.push(rect)
  context.shadowBlur = 0
}

function getProtectedFade(x: number, y: number, width: number, height: number) {
  const protectedAreas = [
    {
      centerX: width / 2,
      centerY: height * 0.43,
      halfWidth: Math.min(380, width * 0.34),
      halfHeight: 130,
    },
    {
      centerX: width / 2,
      centerY: height * 0.52,
      halfWidth: Math.min(340, width * 0.31),
      halfHeight: 78,
    },
  ]

  return protectedAreas.reduce((alpha, area) => {
    const dx = Math.max(0, Math.abs(x - area.centerX) - area.halfWidth)
    const dy = Math.max(0, Math.abs(y - area.centerY) - area.halfHeight)
    const distance = Math.hypot(dx, dy)

    return Math.min(alpha, Math.min(1, distance / 96))
  }, 1)
}

function drawSkyLabel(context: CanvasRenderingContext2D, entity: PublicStarEntity, width: number, height: number) {
  const font = '500 15px "LXGW WenKai", "Songti SC", "Microsoft YaHei", sans-serif'
  const edgeFade = Math.min(
    1,
    Math.max(0, (entity.x + 100) / 160),
    Math.max(0, (width - entity.x + 100) / 160),
  )
  const protectedFade = getProtectedFade(entity.x, entity.y, width, height)
  const alpha = edgeFade * protectedFade * 0.72

  if (alpha < 0.08) {
    return
  }

  context.save()
  context.globalAlpha = alpha
  context.font = font
  context.textBaseline = 'middle'
  context.textAlign = 'left'
  context.shadowBlur = 6
  context.shadowColor = 'rgb(255 255 255 / 0.42)'
  context.fillStyle = 'rgb(28 78 114 / 0.82)'

  const layout = getLabelLayout(context, entity.label, font)
  const x = Math.min(Math.max(14, entity.x + 20), Math.max(14, width - layout.width - 14))
  const y = Math.min(Math.max(28, entity.y + 2), height - layout.height - 26)

  for (const [index, line] of layout.lines.entries()) {
    context.fillText(line.text, x, y + index * 18)
  }

  context.restore()
}

function drawEntryEvent(context: CanvasRenderingContext2D, width: number, height: number, time: number, currentMode: PublicStarSceneMode) {
  const event = entryEvent.value

  if (!event) {
    return
  }

  const elapsed = isReducedMotion.value ? 1600 : time - event.startedAt

  if (elapsed > 1800) {
    entryEvent.value = null
    return
  }

  const progress = Math.min(1, Math.max(0, elapsed / 1600))
  const x = -140 + progress * (width + 280)
  const y = currentMode === 'galaxy'
    ? height * 0.12 + progress * height * 0.46
    : height * 0.18 + Math.sin(progress * Math.PI) * -54 + progress * height * 0.1

  context.save()

  if (currentMode === 'galaxy') {
    context.strokeStyle = `rgb(255 230 174 / ${1 - progress * 0.35})`
    context.lineWidth = 2
    context.shadowColor = 'rgb(255 225 164 / 0.9)'
    context.shadowBlur = 26
    context.beginPath()
    context.moveTo(x - 150, y - 56)
    context.lineTo(x, y)
    context.stroke()
    context.fillStyle = '#fff3c7'
    context.beginPath()
    context.arc(x, y, 3.8, 0, Math.PI * 2)
    context.fill()
  }
  else {
    context.translate(x, y)
    context.strokeStyle = 'rgb(20 82 128 / 0.78)'
    context.lineWidth = 2.4
    context.lineCap = 'round'
    context.shadowColor = 'rgb(255 241 158 / 0.72)'
    context.shadowBlur = 22
    context.beginPath()
    context.moveTo(-16, 0)
    context.quadraticCurveTo(-6, -13, 0, 0)
    context.quadraticCurveTo(8, -12, 18, 0)
    context.stroke()
    context.translate(-x, -y)
  }

  const eventEntity = {
    id: event.id,
    label: event.name,
    x,
    y,
    seed: 0,
    orbit: 0,
    activityAt: null,
    activityKind: 'created',
  } satisfies PublicStarEntity

  if (currentMode === 'galaxy') {
    drawLabel(context, eventEntity, currentMode)
  }
  else {
    drawSkyLabel(context, eventEntity, width, height)
  }

  context.restore()
}

function draw(time = performance.now()) {
  const element = canvas.value
  const context = getCanvasContext()

  if (!element || !context) {
    return
  }

  const { width, height } = resizeCanvas(element, context)
  const currentMode = sceneMode.value
  const entities = currentMode === 'galaxy'
    ? createPublicStarEntities(props.stars, { width, height })
    : createFlyingBirdEntities(props.stars, { width, height }, isReducedMotion.value ? 0 : time)
  const occupiedLabels: LabelRect[] = [{
    x: width * 0.22,
    y: height * 0.2,
    width: width * 0.56,
    height: height * 0.58,
  }]

  context.clearRect(0, 0, width, height)

  if (currentMode === 'galaxy') {
    drawGalaxyBackground(context, width, height, time)
  }
  else {
    drawSkyBackground(context, width, height, time)
  }

  drawEntryEvent(context, width, height, time, currentMode)

  for (const entity of entities) {
    if (currentMode === 'galaxy') {
      drawGalaxyStar(context, entity, time)
    }
    else {
      drawSkyBird(context, entity, time)
    }

    if (currentMode === 'galaxy') {
      drawLabel(context, entity, currentMode, occupiedLabels)
    }
    else {
      drawSkyLabel(context, entity, width, height)
    }
  }
}

function stopLoop() {
  window.cancelAnimationFrame(animationFrame)
  animationFrame = 0
}

function tick(time: number) {
  draw(time)

  if (!isReducedMotion.value) {
    animationFrame = window.requestAnimationFrame(tick)
  }
}

function startLoop() {
  stopLoop()

  if (isReducedMotion.value) {
    draw()
    return
  }

  animationFrame = window.requestAnimationFrame(tick)
}

function syncMediaState() {
  mode.value = resolveSceneMode(Boolean(darkQuery?.matches))
  isReducedMotion.value = Boolean(reducedMotionQuery?.matches)
  startLoop()
}

function consumeEntryEvent() {
  const raw = window.localStorage.getItem(entryEventKey)

  if (!raw) {
    return
  }

  window.localStorage.removeItem(entryEventKey)

  try {
    const parsed = JSON.parse(raw) as { id?: string, name?: string, at?: string }
    const createdAt = parsed.at ? new Date(parsed.at).getTime() : 0
    const isFresh = Number.isFinite(createdAt) && Date.now() - createdAt <= 1000 * 60 * 5

    if (!parsed.id || !parsed.name || !isFresh) {
      return
    }

    entryEvent.value = {
      id: parsed.id,
      name: parsed.name,
      startedAt: performance.now(),
    }
    flashes.set(parsed.id, performance.now())
  }
  catch {
    entryEvent.value = null
  }
}

function handleResize() {
  startLoop()
}

watch(() => props.stars, () => {
  startLoop()
}, { deep: true })

watch(() => props.flashIds, (ids) => {
  const now = performance.now()

  for (const id of ids) {
    flashes.set(id, now)
  }

  startLoop()
})

onMounted(() => {
  consumeEntryEvent()

  if (typeof window.matchMedia === 'function') {
    darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
    reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  }

  syncMediaState()
  darkQuery?.addEventListener('change', syncMediaState)
  reducedMotionQuery?.addEventListener('change', syncMediaState)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  stopLoop()
  darkQuery?.removeEventListener('change', syncMediaState)
  reducedMotionQuery?.removeEventListener('change', syncMediaState)
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <section class="public-star-home" :data-mode="mode" aria-label="公开星图入口">
    <canvas ref="canvas" class="public-star-home__canvas" aria-hidden="true" />
    <div class="public-star-home__gate">
      <slot />
    </div>
  </section>
</template>
