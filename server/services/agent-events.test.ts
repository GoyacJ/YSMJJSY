import { describe, expect, it } from 'vitest'
import { buildAgentEvent, buildOrganizingReportEvent, serializeAgentEventForOs } from './agent-events'

describe('agent event helpers', () => {
  it('builds typed private events', () => {
    expect(buildAgentEvent({
      id: 'event_1',
      agentId: 'agent_1',
      type: 'tool.failed',
      title: '工具失败',
      summary: '生成图片失败。',
      targetType: 'tool',
      targetId: 'star.generateImage',
      payload: { providerBody: 'hidden' },
      createdAt: '2026-05-18T00:00:00.000Z',
    })).toMatchObject({
      type: 'tool.failed',
      payloadJson: '{"providerBody":"hidden"}',
      visibility: 'private',
    })
  })

  it('does not serialize payload json into os event lists', () => {
    const event = buildAgentEvent({
      id: 'event_1',
      agentId: 'agent_1',
      type: 'provider.failed',
      title: 'Provider failed',
      summary: '模型失败。',
      payload: { raw: 'secret' },
      createdAt: '2026-05-18T00:00:00.000Z',
    })

    expect(JSON.stringify(serializeAgentEventForOs(event))).not.toContain('secret')
  })

  it('builds private organizing report events', () => {
    expect(buildOrganizingReportEvent({
      id: 'event_1',
      agentId: 'agent_1',
      sleepRunId: 'sleep_1',
      report: {
        title: '整理报告',
        summary: '整理完成。',
        sections: [
          { type: 'new_memory', title: '新记忆', items: ['用户喜欢短句。'] },
        ],
      },
      createdAt: '2026-05-19T00:00:00.000Z',
    })).toMatchObject({
      type: 'organizing_report.completed',
      title: '整理报告',
      summary: '整理完成。',
      targetType: 'sleep',
      targetId: 'sleep_1',
      visibility: 'private',
    })
  })
})
