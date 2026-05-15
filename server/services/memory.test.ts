import { describe, expect, it } from 'vitest'
import { shouldPersistMemory } from './memory'

describe('memory filtering', () => {
  it('keeps explicit high-importance memories', () => {
    expect(shouldPersistMemory({
      shouldRemember: true,
      type: 'emotion',
      content: '她说她喜欢安静的星空',
      importance: 0.8,
    })).toBe(true)
  })

  it('rejects low-importance memories', () => {
    expect(shouldPersistMemory({
      shouldRemember: true,
      type: 'emotion',
      content: '普通寒暄',
      importance: 0.2,
    })).toBe(false)
  })

  it('rejects inferred romantic status', () => {
    expect(shouldPersistMemory({
      shouldRemember: true,
      type: 'emotion',
      content: '她一定已经喜欢用户',
      importance: 0.9,
    })).toBe(false)
  })
})
