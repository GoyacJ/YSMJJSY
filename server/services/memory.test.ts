import { describe, expect, it } from 'vitest'
import { normalizeMemory, shouldPersistMemory } from './memory'

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

  it('keeps allowed agent memory types', () => {
    for (const type of ['event', 'person', 'creative_asset']) {
      expect(shouldPersistMemory({
        shouldRemember: true,
        type,
        content: `${type} 明确记忆`,
        importance: 0.8,
        confidence: 0.9,
      })).toBe(true)
    }
  })

  it('rejects low-confidence memories', () => {
    expect(shouldPersistMemory({
      shouldRemember: true,
      type: 'event',
      content: '用户提到一个可能的周末安排',
      importance: 0.8,
      confidence: 0.4,
    })).toBe(false)
  })

  it('defaults normalized memory status to active', () => {
    expect(normalizeMemory({
      shouldRemember: true,
      type: 'event',
      content: '  她提到周五想看星星  ',
      importance: 0.8,
      confidence: 0.9,
    })).toEqual({
      type: 'event',
      content: '她提到周五想看星星',
      importance: 0.8,
      confidence: 0.9,
      status: 'active',
    })
  })
})
