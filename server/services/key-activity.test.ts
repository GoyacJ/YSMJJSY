import { describe, expect, it } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createKeyProfileRepository } from '../db/sqlite'
import { markKeyActivity } from './key-activity'

describe('key activity service', () => {
  it('updates public star activity', () => {
    const path = join(tmpdir(), `ysmjjsy-key-activity-${Date.now()}-${Math.random()}.sqlite`)
    const repo = createKeyProfileRepository(path)

    repo.addKeyProfile({
      id: 'key_1',
      keyLookupHash: 'lookup_1',
      assistantName: '阿月',
      mbti: 'INTJ',
      configuredAt: '2026-05-16T00:00:00.000Z',
      createdIpHash: 'ip_hash_1',
      createdAt: '2026-05-16T00:00:00.000Z',
      updatedAt: '2026-05-16T00:00:00.000Z',
      activityAt: null,
      activityKind: null,
    })

    markKeyActivity(path, 'key_1', 'chat', '2026-05-16T00:10:00.000Z')

    expect(repo.listPublicStars()[0]).toMatchObject({
      activityAt: '2026-05-16T00:10:00.000Z',
      activityKind: 'chat',
    })
  })
})
