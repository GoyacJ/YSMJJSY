import { describe, expect, it } from 'vitest'
import { mapPublicStar } from './public-stars.get'

describe('public stars api helpers', () => {
  it('maps only safe public fields', () => {
    expect(mapPublicStar({
      id: 'key_1',
      name: '阿月',
      mbti: 'INTJ',
      createdAt: '2026-05-16T00:00:00.000Z',
      activityAt: '2026-05-16T00:01:00.000Z',
      activityKind: 'chat',
    })).toEqual({
      id: 'key_1',
      name: '阿月',
      mbti: 'INTJ',
      createdAt: '2026-05-16T00:00:00.000Z',
      activityAt: '2026-05-16T00:01:00.000Z',
      activityKind: 'chat',
    })
  })
})
