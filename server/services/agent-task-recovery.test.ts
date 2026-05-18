import { describe, expect, it, vi } from 'vitest'
import { recoverStaleRunningTasks } from './agent-task-recovery'

describe('agent task recovery', () => {
  it('marks stale running tasks as failed and writes an event', () => {
    const updateTask = vi.fn()
    const addEvent = vi.fn()

    recoverStaleRunningTasks({
      now: '2026-05-18T02:00:00.000Z',
      staleAfterMs: 60 * 60 * 1000,
      tasks: [
        {
          id: 'task_1',
          agentId: 'agent_1',
          type: 'generate_artifact',
          status: 'running',
          title: '生成作品',
          summary: '生成。',
          inputJson: '{}',
          resultJson: null,
          error: null,
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
        },
      ],
      taskRepo: { updateTask },
      events: { addEvent },
    } as any)

    expect(updateTask).toHaveBeenCalledWith('task_1', expect.objectContaining({
      status: 'failed',
    }))
    expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'task.failed',
    }))
  })
})
