import type { StarBoundarySettings } from '../db/sqlite'

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
  status: 'active' | 'pending'
}

const allowedMemoryTypes = new Set<AgentMemoryType>(['emotion', 'preference', 'event', 'person', 'creative_asset'])
const inferencePatterns = [
  '一定',
  '肯定',
  '已经喜欢',
  '必然',
  '说明她喜欢',
]
const sensitiveTextPatterns = [
  /身份证/,
  /护照/,
  /银行卡/,
  /银行账户/,
  /支付密码/,
  /登录密码/,
  /密码/,
  /手机号/,
  /手机号码/,
  /电话号码/,
  /住址/,
  /家庭地址/,
  /家庭住址/,
  /身份证号/,
  /社保/,
  /病历/,
  /诊断/,
  /用药/,
  /\b1[3-9]\d{9}\b/,
  /\b\d{17}[\dXx]\b/,
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

function stripPreferenceMarkers(value: string) {
  return normalizeComparableText(value)
    .replace(/用户|她|他|ta|本人/g, '')
    .replace(/不喜欢|喜欢|讨厌|偏好|不想要|想要/g, '')
}

export function detectMemoryConflict(candidate: string, activeMemories: string[]) {
  const normalizedCandidate = normalizeComparableText(candidate)
  const candidateSubject = stripPreferenceMarkers(candidate)

  if (!normalizedCandidate || !candidateSubject) {
    return null
  }

  const candidateNegative = normalizedCandidate.includes('不喜欢') || normalizedCandidate.includes('讨厌') || normalizedCandidate.includes('不想要')
  const candidatePositive = !candidateNegative && (normalizedCandidate.includes('喜欢') || normalizedCandidate.includes('偏好') || normalizedCandidate.includes('想要'))

  if (!candidateNegative && !candidatePositive) {
    return null
  }

  for (const memory of activeMemories) {
    const normalizedMemory = normalizeComparableText(memory)
    const memorySubject = stripPreferenceMarkers(memory)
    const memoryNegative = normalizedMemory.includes('不喜欢') || normalizedMemory.includes('讨厌') || normalizedMemory.includes('不想要')
    const memoryPositive = !memoryNegative && (normalizedMemory.includes('喜欢') || normalizedMemory.includes('偏好') || normalizedMemory.includes('想要'))

    if (!memorySubject || candidateSubject !== memorySubject) {
      continue
    }

    if ((candidateNegative && memoryPositive) || (candidatePositive && memoryNegative)) {
      return 'conflicting_preference'
    }
  }

  return null
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

  if ((memory.confidence ?? 1) < 0.75) {
    return false
  }

  return !inferencePatterns.some(pattern => memory.content.includes(pattern))
}

export function isSensitiveMemoryContent(content: string) {
  return sensitiveTextPatterns.some(pattern => pattern.test(content))
}

function matchesTopic(content: string, topics: string[]) {
  const text = content.toLowerCase()

  return topics.some((topic) => {
    const normalized = topic.trim().toLowerCase()
    return normalized && text.includes(normalized)
  })
}

export function isDisallowedMemoryContent(content: string, boundarySettings: StarBoundarySettings) {
  return matchesTopic(content, boundarySettings.disallowedMemoryTopics)
}

export function resolveMemoryWriteStatus(memory: Pick<NormalizedMemory, 'content' | 'importance'>, boundarySettings: StarBoundarySettings): NormalizedMemory['status'] {
  const allowedTopics = boundarySettings.allowedMemoryTopics
    .map(topic => topic.trim())
    .filter(Boolean)

  if (allowedTopics.length > 0 && !matchesTopic(memory.content, allowedTopics)) {
    return 'pending'
  }

  if (boundarySettings.requireApprovalForSensitiveMemory && isSensitiveMemoryContent(memory.content)) {
    return 'pending'
  }

  if (boundarySettings.memoryWriteMode === 'manual') {
    return 'pending'
  }

  if (boundarySettings.memoryWriteMode === 'assisted' && memory.importance >= 0.9) {
    return 'pending'
  }

  return 'active'
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
