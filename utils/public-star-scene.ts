export type PublicStar = {
  id: string
  name: string
  mbti: string
  createdAt: string
  activityAt?: string | null
  activityKind?: 'created' | 'profile' | 'chat' | 'design' | 'media' | null
}

export type SceneBounds = {
  width: number
  height: number
}

export type PublicStarEntity = {
  id: string
  label: string
  x: number
  y: number
  seed: number
  orbit: number
  activityAt?: string | null
  activityKind?: PublicStar['activityKind']
}

export type PublicStarSceneMode = 'galaxy' | 'sky'

export function resolveSceneMode(prefersDark: boolean): PublicStarSceneMode {
  return prefersDark ? 'galaxy' : 'sky'
}

export function hashSeed(input: string) {
  let hash = 2166136261

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function seededUnit(seed: number, salt: number) {
  const mixed = Math.imul(seed ^ Math.imul(salt + 1, 2654435761), 2246822519)
  return ((mixed >>> 0) % 10000) / 10000
}

function resolveRange(min: number, max: number) {
  if (max >= min) {
    return { min, max }
  }

  const center = (min + max) / 2
  return { min: center, max: center }
}

function interpolate(min: number, max: number, amount: number) {
  return min + (max - min) * amount
}

export function createPublicStarEntities(stars: PublicStar[], bounds: SceneBounds): PublicStarEntity[] {
  const width = Math.max(320, bounds.width)
  const height = Math.max(420, bounds.height)
  const skyBottom = height * 0.64
  const centerX = width / 2
  const centerY = skyBottom * 0.52
  const margin = Math.min(58, Math.max(24, width * 0.035))
  const maxX = width - margin - 70
  const safeHalfWidth = Math.min(310, width * 0.24)
  const safeHalfHeight = Math.min(145, skyBottom * 0.24)
  const top = resolveRange(margin, centerY - safeHalfHeight - 34)
  const bottom = resolveRange(centerY + safeHalfHeight + 34, skyBottom - margin)
  const left = resolveRange(margin, centerX - safeHalfWidth - 34)
  const right = resolveRange(centerX + safeHalfWidth + 34, maxX)
  const centerRadiusX = Math.min(320, width * 0.28)
  const centerRadiusY = Math.min(140, skyBottom * 0.22)

  return stars.map((star, index) => {
    const seed = hashSeed(star.id)
    const lane = index % 10
    const orbit = 0.28 + ((seed % 100) / 100) * 0.72
    const primary = seededUnit(seed, index + 11)
    const secondary = seededUnit(seed, index + 41)
    let x = centerX
    let y = centerY

    if (lane === 0 || lane === 4) {
      x = interpolate(margin, maxX, primary)
      y = interpolate(top.min, top.max, secondary)
    }
    else if (lane === 1 || lane === 5) {
      x = interpolate(right.min, right.max, secondary)
      y = interpolate(margin, skyBottom - margin, primary)
    }
    else if (lane === 2 || lane === 6) {
      x = interpolate(margin, maxX, secondary)
      y = interpolate(bottom.min, bottom.max, primary)
    }
    else if (lane === 3 || lane === 7) {
      x = interpolate(left.min, left.max, primary)
      y = interpolate(margin, skyBottom - margin, secondary)
    }
    else {
      const angle = seededUnit(seed, index + 71) * Math.PI * 2
      const radius = 0.36 + seededUnit(seed, index + 97) * 0.56
      x = centerX + Math.cos(angle) * centerRadiusX * radius
      y = centerY + Math.sin(angle) * centerRadiusY * radius
    }

    return {
      id: star.id,
      label: star.name,
      x,
      y,
      seed,
      orbit,
      activityAt: star.activityAt ?? null,
      activityKind: star.activityKind ?? null,
    }
  })
}

export function createFlyingBirdEntities(stars: PublicStar[], bounds: SceneBounds, timeMs: number): PublicStarEntity[] {
  const width = Math.max(320, bounds.width)
  const height = Math.max(420, bounds.height)
  const margin = Math.min(72, Math.max(30, width * 0.04))
  const laneCount = Math.min(10, Math.max(4, Math.ceil(stars.length / 5)))
  const laneGap = (height - margin * 2) / Math.max(1, laneCount - 1)

  return stars.map((star, index) => {
    const seed = hashSeed(star.id)
    const duration = 16000 + (seed % 9000)
    const offset = seededUnit(seed, 9) * duration
    const progress = ((timeMs + offset) % duration) / duration
    const lane = index % laneCount
    const yDrift = (seededUnit(seed, 17) - 0.5) * Math.min(48, laneGap * 0.52)
    const wave = Math.sin(progress * Math.PI * 2 + seededUnit(seed, 23) * Math.PI) * 12
    const y = margin + lane * laneGap + yDrift + wave

    return {
      id: star.id,
      label: star.name,
      x: -150 + progress * (width + 300),
      y: Math.min(height - margin, Math.max(margin, y)),
      seed,
      orbit: 0.28 + ((seed % 100) / 100) * 0.72,
      activityAt: star.activityAt ?? null,
      activityKind: star.activityKind ?? null,
    }
  })
}

export function findChangedActivityIds(previous: PublicStar[], next: PublicStar[]) {
  const previousById = new Map(previous.map(star => [star.id, star.activityAt ?? '']))

  return next
    .filter(star => (star.activityAt ?? '') !== (previousById.get(star.id) ?? ''))
    .map(star => star.id)
}
