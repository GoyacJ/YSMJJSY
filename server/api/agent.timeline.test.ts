import { describe, expect, it } from 'vitest'
import { buildAgentTimeline } from './agent/timeline.get'

describe('agent timeline api helpers', () => {
  it('builds a sorted agent timeline from memories, reflections, proposals, sleep runs, and works', () => {
    const timeline = buildAgentTimeline({
      profile: { createdAt: '2026-05-17T00:00:00.000Z', configuredAt: '2026-05-17T00:01:00.000Z' },
      memories: [{ id: 'm1', content: '用户喜欢短句。', createdAt: '2026-05-17T00:02:00.000Z' }],
      reflections: [{ id: 'r1', summary: '形成短句偏好。', createdAt: '2026-05-17T00:03:00.000Z' }],
      proposals: [],
      sleepRuns: [],
      works: [],
    })

    expect(timeline.map(item => item.type)).toEqual(['profile', 'memory', 'reflection', 'key'])
  })
})
