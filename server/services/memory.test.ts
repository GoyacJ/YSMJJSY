import { describe, expect, it } from 'vitest'
import { defaultStarBoundarySettings } from '../db/sqlite'
import {
  detectMemoryConflict,
  isSensitiveMemoryContent,
  isSimilarRejectedMemory,
  normalizeMemory,
  resolveMemoryWriteStatus,
  shouldPersistMemory,
} from './memory'

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

  it('rejects memories below the confidence staging threshold', () => {
    expect(shouldPersistMemory({
      shouldRemember: true,
      type: 'event',
      content: '用户提到一个周末安排',
      importance: 0.8,
      confidence: 0.7,
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

  it('detects sensitive long-term memory content', () => {
    expect(isSensitiveMemoryContent('用户的身份证号是 110101199001010011。')).toBe(true)
    expect(isSensitiveMemoryContent('用户喜欢短句回复。')).toBe(false)
  })

  it('keeps normal memory active in auto mode', () => {
    expect(resolveMemoryWriteStatus({
      type: 'preference',
      content: '用户喜欢短句回复。',
      importance: 0.8,
      confidence: 0.9,
      status: 'active',
    }, {
      ...defaultStarBoundarySettings,
      memoryWriteMode: 'auto',
    })).toBe('active')
  })

  it('stages normal memory in manual mode', () => {
    expect(resolveMemoryWriteStatus({
      type: 'preference',
      content: '用户喜欢短句回复。',
      importance: 0.8,
      confidence: 0.9,
      status: 'active',
    }, {
      ...defaultStarBoundarySettings,
      memoryWriteMode: 'manual',
    })).toBe('pending')
  })

  it('stages sensitive memory when approval is required', () => {
    expect(resolveMemoryWriteStatus({
      type: 'person',
      content: '用户的手机号是 13800138000。',
      importance: 0.9,
      confidence: 0.95,
      status: 'active',
    }, defaultStarBoundarySettings)).toBe('pending')
  })

  it('stages memories outside an explicit allowed topic list', () => {
    expect(resolveMemoryWriteStatus({
      type: 'preference',
      content: '用户喜欢蓝色。',
      importance: 0.8,
      confidence: 0.9,
      status: 'active',
    }, {
      ...defaultStarBoundarySettings,
      memoryWriteMode: 'auto',
      allowedMemoryTopics: ['写作偏好'],
    })).toBe('pending')
  })

  it('keeps matching allowed topic memories active after other checks pass', () => {
    expect(resolveMemoryWriteStatus({
      type: 'preference',
      content: '用户的写作偏好是短句。',
      importance: 0.8,
      confidence: 0.9,
      status: 'active',
    }, {
      ...defaultStarBoundarySettings,
      memoryWriteMode: 'auto',
      allowedMemoryTopics: [' 写作偏好 '],
    })).toBe('active')
  })

  it('detects exact repeated rejected memory content', () => {
    expect(isSimilarRejectedMemory('用户喜欢短句。', ['用户喜欢短句。'])).toBe(true)
  })

  it('detects close substring rejected memory content', () => {
    expect(isSimilarRejectedMemory('用户喜欢短句回复', ['喜欢短句'])).toBe(true)
  })

  it('ignores unrelated rejected memory content', () => {
    expect(isSimilarRejectedMemory('用户喜欢蓝色。', ['用户喜欢短句。'])).toBe(false)
  })

  it('detects opposite preference conflicts on the same subject', () => {
    expect(detectMemoryConflict('用户不喜欢长句。', ['用户喜欢长句。'])).toBe('conflicting_preference')
  })
})
