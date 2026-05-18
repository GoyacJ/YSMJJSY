import { describe, expect, it, vi } from 'vitest'
import { enqueueAgentTask, runAgentTask } from './agent-task-queue'

describe('agent task queue', () => {
  it('enqueues tasks and writes task queued event', () => {
    const tasks = { addTask: vi.fn() }
    const events = { addEvent: vi.fn() }

    const task = enqueueAgentTask({
      agentId: 'agent_1',
      type: 'sleep',
      title: '睡眠整理',
      summary: '整理最近记忆。',
      input: { keyId: 'key_1' },
      now: '2026-05-18T00:00:00.000Z',
      tasks,
      events,
    } as any)

    expect(task.status).toBe('queued')
    expect(tasks.addTask).toHaveBeenCalledWith(expect.objectContaining({ status: 'queued' }))
    expect(events.addEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'task.queued' }))
  })

  it('runs a queued tool task to completion', async () => {
    const updateTask = vi.fn()
    const addEvent = vi.fn()
    const registry = {
      get: () => ({
        name: 'star.generateImage',
        description: 'Generate image',
        riskLevel: 'medium',
        approvalRequired: false,
        execute: vi.fn(async () => ({ ok: true, output: { url: 'u' } })),
      }),
      execute: vi.fn(async () => ({ ok: true, output: { url: 'u' } })),
    }

    await runAgentTask({
      task: {
        id: 'task_1',
        agentId: 'agent_1',
        type: 'generate_artifact',
        status: 'queued',
        title: '生成图片',
        summary: '生成图片。',
        inputJson: '{"toolName":"star.generateImage","input":{"prompt":"star"}}',
        createdAt: '2026-05-18T00:00:00.000Z',
        updatedAt: '2026-05-18T00:00:00.000Z',
      },
      now: '2026-05-18T00:01:00.000Z',
      tasks: { updateTask },
      events: { addEvent },
      registry,
      policy: { autoRunLowRiskTasks: true } as any,
    } as any)

    expect(updateTask).toHaveBeenCalledWith('task_1', expect.objectContaining({ status: 'completed' }))
    expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'task.completed' }))
  })

  it('writes tool audit events around task execution', async () => {
    const updateTask = vi.fn()
    const addEvent = vi.fn()
    const registry = {
      get: () => ({
        name: 'star.generateImage',
        description: 'Generate image',
        riskLevel: 'medium',
        approvalRequired: false,
        execute: vi.fn(async () => ({ ok: true, output: { url: 'u' } })),
      }),
      execute: vi.fn(async () => ({ ok: true, output: { url: 'u' } })),
    }

    await runAgentTask({
      task: {
        id: 'task_1',
        agentId: 'agent_1',
        type: 'generate_artifact',
        status: 'queued',
        title: '生成图片',
        summary: '生成图片。',
        inputJson: '{"toolName":"star.generateImage","input":{"prompt":"star"}}',
        createdAt: '2026-05-18T00:00:00.000Z',
        updatedAt: '2026-05-18T00:00:00.000Z',
      },
      now: '2026-05-18T00:01:00.000Z',
      tasks: { updateTask },
      events: { addEvent },
      registry,
      policy: { autoRunLowRiskTasks: true } as any,
    } as any)

    expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'tool.started',
      targetType: 'tool',
      targetId: 'star.generateImage',
    }))
    expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'tool.completed',
      targetType: 'tool',
      targetId: 'star.generateImage',
    }))
  })

  it('marks task failed and writes tool failed event when execution throws', async () => {
    const updateTask = vi.fn()
    const addEvent = vi.fn()
    const registry = {
      get: () => ({
        name: 'star.generateImage',
        description: 'Generate image',
        riskLevel: 'medium',
        approvalRequired: false,
        execute: vi.fn(),
      }),
      execute: vi.fn(async () => {
        throw new Error('provider down')
      }),
    }

    await runAgentTask({
      task: {
        id: 'task_1',
        agentId: 'agent_1',
        type: 'generate_artifact',
        status: 'queued',
        title: '生成图片',
        summary: '生成图片。',
        inputJson: '{"toolName":"star.generateImage","input":{"prompt":"star"}}',
        createdAt: '2026-05-18T00:00:00.000Z',
        updatedAt: '2026-05-18T00:00:00.000Z',
      },
      now: '2026-05-18T00:01:00.000Z',
      tasks: { updateTask },
      events: { addEvent },
      registry,
      policy: { autoRunLowRiskTasks: true } as any,
    } as any)

    expect(updateTask).toHaveBeenCalledWith('task_1', expect.objectContaining({
      status: 'failed',
      error: 'provider down',
    }))
    expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'tool.failed',
      targetType: 'tool',
      targetId: 'star.generateImage',
    }))
  })
})
