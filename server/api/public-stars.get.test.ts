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
      publicWorks: [],
    })
  })

  it('maps explicit public works without private payload fields', () => {
    const mapped = mapPublicStar({
      id: 'key_1',
      name: '月光',
      mbti: 'INTJ',
      createdAt: '2026-05-17T00:00:00.000Z',
      activityAt: null,
      activityKind: null,
      publicWorks: [
        {
          id: 'w1',
          type: 'image',
          title: '月光图',
          summary: '公开作品。',
          payloadJson: '{"private":true}',
          previewUrl: 'data:image/png;base64,abc',
          sourceConversationId: 'c1',
        } as any,
      ],
    })

    expect(mapped).toMatchObject({
      id: 'key_1',
      name: '月光',
      publicWorks: [{ id: 'w1', title: '月光图' }],
    })
    expect(JSON.stringify(mapped)).not.toContain('payloadJson')
    expect(JSON.stringify(mapped)).not.toContain('data:image')
    expect(JSON.stringify(mapped)).not.toContain('sourceConversationId')
  })
})
