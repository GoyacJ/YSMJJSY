import { describe, expect, it } from 'vitest'
import { planAgentTasksFromObservations } from './agent-loop-planner'

describe('agent loop planner', () => {
  it('plans a sleep task when recent observations exceed the threshold', () => {
    const tasks = planAgentTasksFromObservations({
      observations: [
        { id: 'o1', sourceType: 'chat', summary: '用户聊天。', createdAt: '2026-05-18T00:00:00.000Z' },
        { id: 'o2', sourceType: 'chat', summary: '助手回复。', createdAt: '2026-05-18T00:01:00.000Z' },
        { id: 'o3', sourceType: 'chat', summary: '用户继续聊天。', createdAt: '2026-05-18T00:02:00.000Z' },
      ],
      existingTasks: [],
      threshold: 3,
    } as any)

    expect(tasks).toEqual([
      {
        type: 'sleep',
        title: '睡眠整理',
        summary: '根据最近观察整理记忆和提案。',
        input: { toolName: 'star.sleep', input: {} },
      },
    ])
  })

  it('does not plan duplicate sleep tasks when one is already queued or running', () => {
    const tasks = planAgentTasksFromObservations({
      observations: [
        { id: 'o1', sourceType: 'chat', summary: '用户聊天。', createdAt: '2026-05-18T00:00:00.000Z' },
        { id: 'o2', sourceType: 'chat', summary: '助手回复。', createdAt: '2026-05-18T00:01:00.000Z' },
        { id: 'o3', sourceType: 'chat', summary: '用户继续聊天。', createdAt: '2026-05-18T00:02:00.000Z' },
      ],
      existingTasks: [
        { id: 'task_1', type: 'sleep', status: 'queued' },
      ],
      threshold: 3,
    } as any)

    expect(tasks).toEqual([])
  })
})
