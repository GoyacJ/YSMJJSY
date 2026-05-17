export type ExtractedMemory = {
  shouldRemember: boolean
  type: string
  content: string
  importance: number
  confidence?: number
}

export type AgentMemoryType =
  | 'emotion'
  | 'preference'
  | 'event'
  | 'person'
  | 'creative_asset'

export type NormalizedMemory = {
  type: AgentMemoryType
  content: string
  importance: number
  confidence: number
  status: 'active'
}

const allowedMemoryTypes = new Set<AgentMemoryType>(['emotion', 'preference', 'event', 'person', 'creative_asset'])
const inferencePatterns = [
  '一定',
  '肯定',
  '已经喜欢',
  '必然',
  '说明她喜欢',
]

function normalizeComparableText(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s，。！？、,.!?;；:"“”'‘’()[\]{}]/g, '')
}

function characterOverlapRatio(left: string, right: string) {
  const leftChars = new Set(Array.from(left))
  const rightChars = new Set(Array.from(right))
  const smaller = leftChars.size <= rightChars.size ? leftChars : rightChars
  const larger = leftChars.size <= rightChars.size ? rightChars : leftChars
  let overlap = 0

  for (const char of smaller) {
    if (larger.has(char)) {
      overlap += 1
    }
  }

  return smaller.size > 0 ? overlap / smaller.size : 0
}

export function isSimilarRejectedMemory(candidate: string, rejected: string[]) {
  const normalizedCandidate = normalizeComparableText(candidate)

  if (!normalizedCandidate) {
    return false
  }

  return rejected.some((item) => {
    const normalizedRejected = normalizeComparableText(item)

    if (!normalizedRejected) {
      return false
    }

    return normalizedCandidate.includes(normalizedRejected)
      || normalizedRejected.includes(normalizedCandidate)
      || characterOverlapRatio(normalizedCandidate, normalizedRejected) >= 0.9
  })
}

export function shouldPersistMemory(memory: ExtractedMemory) {
  if (!memory.shouldRemember) {
    return false
  }

  if (!allowedMemoryTypes.has(memory.type)) {
    return false
  }

  if (!memory.content.trim()) {
    return false
  }

  if (memory.importance < 0.5) {
    return false
  }

  if ((memory.confidence ?? 1) < 0.65) {
    return false
  }

  return !inferencePatterns.some(pattern => memory.content.includes(pattern))
}

export function normalizeMemoryType(type: string): AgentMemoryType {
  return allowedMemoryTypes.has(type as AgentMemoryType) ? type as AgentMemoryType : 'emotion'
}

export function normalizeMemory(memory: ExtractedMemory): NormalizedMemory {
  return {
    type: normalizeMemoryType(memory.type),
    content: memory.content.trim(),
    importance: memory.importance,
    confidence: memory.confidence ?? 1,
    status: 'active',
  }
}
