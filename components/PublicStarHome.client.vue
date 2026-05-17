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
const galaxyBackgroundSrc = '/images/starry-sky-bg.jpg'

let animationFrame = 0
let darkQuery: MediaQueryList | null = null
let reducedMotionQuery: MediaQueryList | null = null
let galaxyBackgroundImage: HTMLImageElement | null = null

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

function loadGalaxyBackground() {
  const image = new Image()
  image.decoding = 'async'
  image.src = galaxyBackgroundSrc
  galaxyBackgroundImage = image

  image.addEventListener('load', () => {
    startLoop()
  }, { once: true })
}

function drawCoverImage(context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const imageWidth = image.naturalWidth || width
  const imageHeight = image.naturalHeight || height
  const scale = Math.max(width / imageWidth, height / imageHeight)
  const drawWidth = imageWidth * scale
  const drawHeight = imageHeight * scale
  const x = (width - drawWidth) / 2
  const y = (height - drawHeight) / 2

  context.drawImage(image, x, y, drawWidth, drawHeight)
}

function drawGalaxyBackground(context: CanvasRenderingContext2D, width: number, height: number, time: number) {
  if (galaxyBackgroundImage?.complete && galaxyBackgroundImage.naturalWidth > 0) {
    drawCoverImage(context, galaxyBackgroundImage, width, height)
  }
  else {
    const gradient = context.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, '#050b18')
    gradient.addColorStop(0.52, '#0b1231')
    gradient.addColorStop(1, '#160d22')
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)
  }

  context.fillStyle = 'rgb(2 5 16 / 0.42)'
  context.fillRect(0, 0, width, height)

  const veil = context.createRadialGradient(
    width * 0.5,
    height * 0.48,
    Math.min(width, height) * 0.08,
    width * 0.5,
    height * 0.48,
    Math.max(width, height) * 0.58,
  )
  veil.addColorStop(0, 'rgb(3 6 18 / 0.46)')
  veil.addColorStop(0.46, 'rgb(3 6 18 / 0.22)')
  veil.addColorStop(1, 'rgb(0 0 0 / 0.42)')
  context.fillStyle = veil
  context.fillRect(0, 0, width, height)

  const glow = context.createLinearGradient(0, height * 0.18, width, height * 0.72)
  const glowAlpha = isReducedMotion.value ? 0.1 : 0.1 + Math.sin(time / 2600) * 0.025
  glow.addColorStop(0, 'rgb(120 156 255 / 0)')
  glow.addColorStop(0.54, `rgb(146 176 255 / ${glowAlpha})`)
  glow.addColorStop(1, 'rgb(255 208 170 / 0)')
  context.fillStyle = glow
  context.fillRect(0, 0, width, height)
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
  const workGlow = entity.publicWorkCount > 0 ? 1 : 0
  const coreRadius = 1.15 + pulse * 0.35 + flash * 1.3 + workGlow * 0.45
  const primaryRay = 7 + entity.orbit * 7 + flash * 10 + workGlow * 4
  const secondaryRay = primaryRay * 0.32
  const tint = entity.seed % 3 === 0
    ? '255 226 180'
    : entity.seed % 3 === 1 ? '218 232 255' : '255 248 221'

  context.save()
  context.translate(entity.x, entity.y)
  context.rotate((entity.seed % 360) * Math.PI / 180)

  const halo = context.createRadialGradient(0, 0, 0, 0, 0, 11 + flash * 14)
  halo.addColorStop(0, `rgb(${tint} / ${0.34 + flash * 0.25})`)
  halo.addColorStop(0.36, `rgb(${tint} / ${0.08 + flash * 0.2})`)
  halo.addColorStop(1, `rgb(${tint} / 0)`)
  context.fillStyle = halo
  context.beginPath()
  context.arc(0, 0, 11 + flash * 14, 0, Math.PI * 2)
  context.fill()

  context.globalAlpha = 0.48 + flash * 0.26
  context.strokeStyle = `rgb(${tint} / 0.82)`
  context.lineWidth = 0.72
  context.lineCap = 'round'
  context.beginPath()
  context.moveTo(-primaryRay, 0)
  context.lineTo(primaryRay, 0)
  context.moveTo(0, -primaryRay * 0.78)
  context.lineTo(0, primaryRay * 0.78)
  context.stroke()

  context.rotate(Math.PI / 4)
  context.globalAlpha = 0.18 + flash * 0.2
  context.lineWidth = 0.52
  context.beginPath()
  context.moveTo(-secondaryRay, 0)
  context.lineTo(secondaryRay, 0)
  context.moveTo(0, -secondaryRay)
  context.lineTo(0, secondaryRay)
  context.stroke()

  context.rotate(-Math.PI / 4)
  context.globalAlpha = 1
  context.shadowColor = `rgb(${tint} / ${0.62 + flash * 0.35})`
  context.shadowBlur = 4 + flash * 9
  context.fillStyle = `rgb(255 252 238 / ${0.94 + pulse * 0.04})`
  context.beginPath()
  context.arc(0, 0, coreRadius, 0, Math.PI * 2)
  context.fill()

  if (flash > 0) {
    context.globalAlpha = flash * 0.32
    context.strokeStyle = `rgb(${tint} / 0.86)`
    context.lineWidth = 0.8
    context.beginPath()
    context.arc(0, 0, 9 + flash * 12, 0, Math.PI * 2)
    context.stroke()
  }

  context.restore()
}

function drawSkyBird(context: CanvasRenderingContext2D, entity: PublicStarEntity, time: number) {
  const flap = isReducedMotion.value ? 0.22 : Math.sin(time / 280 + entity.seed) * 0.38
  const flash = getFlashAlpha(entity, time)
  const workGlow = entity.publicWorkCount > 0 ? 1 : 0

  context.save()
  context.translate(entity.x, entity.y)
  context.strokeStyle = `rgb(24 77 117 / ${0.64 + flash * 0.3 + workGlow * 0.12})`
  context.lineWidth = 2 + workGlow * 0.4
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
    publicWorkCount: 0,
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
  loadGalaxyBackground()

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
    <div class="public-star-home__works" aria-label="公开作品">
      <p v-for="star in stars.filter(item => item.publicWorks?.length)" :key="star.id">
        {{ star.name }} · 公开作品 {{ star.publicWorks?.length ?? 0 }}
      </p>
    </div>
    <div class="public-star-home__gate">
      <slot />
    </div>
  </section>
</template>
