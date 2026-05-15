export type ExtractedMemory = {
  shouldRemember: boolean
  type: string
  content: string
  importance: number
}

const allowedMemoryTypes = new Set(['emotion', 'preference'])
const inferencePatterns = [
  '一定',
  '肯定',
  '已经喜欢',
  '必然',
  '说明她喜欢',
]

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

  return !inferencePatterns.some(pattern => memory.content.includes(pattern))
}

export function normalizeMemoryType(type: string): 'emotion' | 'preference' {
  return type === 'preference' ? 'preference' : 'emotion'
}
