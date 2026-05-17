import { describe, expect, it } from 'vitest'
import { buildAgentTimeline } from './agent/timeline.get'

describe('agent timeline api helpers', () => {
  it('builds a sorted agent timeline from memories, reflections, proposals, sleep runs, and works', () => {
    const timeline = buildAgentTimeline({
      profile: { createdAt: '2026-05-17T00:00:00.000Z', configuredAt: '2026-05-17T00:01:00.000Z' },
      memories: [{ id: 'm1', content: '用户喜欢短句。', createdAt: '2026-05-17T00:03:00.000Z' }],
      reflections: [{ id: 'r1', summary: '形成短句偏好。', createdAt: '2026-05-17T00:05:00.000Z' }],
      proposals: [{ id: 'p1', title: '调整语气', summary: '回复更短。', createdAt: '2026-05-17T00:02:00.000Z' }],
      sleepRuns: [{ id: 's1', summary: '睡眠整理完成。', status: 'completed', startedAt: '2026-05-17T00:06:00.000Z' }],
      works: [{ id: 'w1', type: 'video', title: '视频作品', summary: '开始生成视频。', createdAt: '2026-05-17T00:04:00.000Z' }],
    })

    expect(timeline.map(item => item.id)).toEqual(['s1', 'r1', 'w1', 'm1', 'p1', 'profile', 'key'])
    expect(timeline.map(item => item.createdAt)).toEqual([
      '2026-05-17T00:06:00.000Z',
      '2026-05-17T00:05:00.000Z',
      '2026-05-17T00:04:00.000Z',
      '2026-05-17T00:03:00.000Z',
      '2026-05-17T00:02:00.000Z',
      '2026-05-17T00:01:00.000Z',
      '2026-05-17T00:00:00.000Z',
    ])
  })
})
