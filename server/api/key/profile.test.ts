import { describe, expect, it } from 'vitest'
import { parseProfileUpdate } from './profile.put'

describe('key profile api helpers', () => {
  it('accepts a valid assistant profile update', () => {
    expect(parseProfileUpdate({
      assistantName: '星信',
      mbti: 'INTJ',
    })).toEqual({
      assistantName: '星信',
      mbti: 'INTJ',
    })
  })

  it('rejects invalid MBTI values', () => {
    expect(() => parseProfileUpdate({
      assistantName: '星信',
      mbti: 'ABCD',
    })).toThrow()
  })
})
