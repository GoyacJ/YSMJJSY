import { describe, expect, it } from 'vitest'
import { parseProfileUpdate, resolveProfileActivityKind } from './profile.put'

describe('key profile api helpers', () => {
  it('accepts a valid assistant profile update', () => {
    expect(parseProfileUpdate({
      assistantName: '星信',
      mbti: 'INTJ',
      boundarySettings: {
        memoryWriteMode: 'manual',
        generatedWorksDefaultVisibility: 'private',
        requireApprovalForPublishing: true,
        requireApprovalForPersonaChange: true,
        requireApprovalForSensitiveMemory: true,
        disallowedMemoryTopics: ['身份证号'],
        allowedMemoryTopics: ['写作偏好'],
        minorMode: true,
      },
    })).toEqual({
      assistantName: '星信',
      mbti: 'INTJ',
      boundarySettings: {
        memoryWriteMode: 'manual',
        generatedWorksDefaultVisibility: 'private',
        requireApprovalForPublishing: true,
        requireApprovalForPersonaChange: true,
        requireApprovalForSensitiveMemory: true,
        disallowedMemoryTopics: ['身份证号'],
        allowedMemoryTopics: ['写作偏好'],
        minorMode: true,
      },
    })
  })

  it('rejects invalid MBTI values', () => {
    expect(() => parseProfileUpdate({
      assistantName: '星信',
      mbti: 'ABCD',
    })).toThrow()
  })

  it('marks first profile save as created activity', () => {
    expect(resolveProfileActivityKind(null)).toBe('created')
  })

  it('marks later profile save as profile activity', () => {
    expect(resolveProfileActivityKind('2026-05-16T00:00:00.000Z')).toBe('profile')
  })
})
