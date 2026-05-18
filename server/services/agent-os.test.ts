import { describe, expect, it } from 'vitest'
import { buildAgentInbox, buildAgentOsResponse } from './agent-os'

describe('agent os service', () => {
  it('builds a private OS response from agent records', () => {
    const result = buildAgentOsResponse({
      agent: {
        id: 'agent_1',
        status: 'active',
        createdAt: '2026-05-18T00:00:00.000Z',
        updatedAt: '2026-05-18T00:00:00.000Z',
        bindingId: 'binding_1',
        ownerType: 'key',
        ownerId: 'key_1',
        domain: 'star',
      },
      tasks: [
        {
          id: 'task_1',
          agentId: 'agent_1',
          type: 'sleep',
          status: 'completed',
          title: '睡眠整理',
          summary: '整理完成。',
          inputJson: '{}',
          resultJson: '{"dailySummary":"整理完成。"}',
          error: null,
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:01:00.000Z',
        },
      ],
      events: [
        {
          id: 'event_1',
          agentId: 'agent_1',
          type: 'task.completed',
          title: '任务完成',
          summary: '整理完成。',
          targetType: 'task',
          targetId: 'task_1',
          payloadJson: '{"private":"hidden"}',
          visibility: 'private',
          createdAt: '2026-05-18T00:01:00.000Z',
        },
      ],
      pendingProposals: [
        {
          id: 'proposal_1',
          keyId: 'key_1',
          reflectionId: null,
          type: 'tone',
          title: '更短',
          summary: '回复更短。',
          payloadJson: '{"tone":"更短"}',
          status: 'pending',
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
        },
      ],
      publicWorkCandidates: [],
    })

    expect(result.agent.id).toBe('agent_1')
    expect(result.tasks[0].status).toBe('completed')
    expect(result.events[0]).not.toHaveProperty('payload')
    expect(result.inbox).toMatchObject([{ id: 'proposal:proposal_1', type: 'proposal', title: '更短' }])
  })

  it('builds inbox items for proposals and public work candidates', () => {
    expect(buildAgentInbox({
      pendingProposals: [],
      publicWorkCandidates: [
        {
          id: 'work_1',
          keyId: 'key_1',
          type: 'image',
          title: '月光图',
          summary: '一张图。',
          payloadJson: '{}',
          visibility: 'private',
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
        },
      ],
    })).toMatchObject([
      { id: 'work_visibility:work_1', type: 'work_visibility', action: 'publish' },
    ])
  })

  it('builds inbox items from sleep memory actions and waiting approval tasks', () => {
    const result = buildAgentInbox({
      pendingProposals: [],
      publicWorkCandidates: [],
      memoryActionCandidates: [
        { memoryId: 'm1', action: 'archive', reason: '过期。', createdAt: '2026-05-18T00:00:00.000Z' },
      ],
      waitingApprovalTasks: [
        {
          id: 'task_1',
          type: 'publish_artifact',
          status: 'waiting_approval',
          title: '公开作品',
          summary: '公开月光图。',
          createdAt: '2026-05-18T00:00:00.000Z',
        },
      ],
    } as any)

    expect(result.map(item => item.id)).toEqual([
      'memory_governance:m1:archive',
      'task_approval:task_1',
    ])
  })
})
