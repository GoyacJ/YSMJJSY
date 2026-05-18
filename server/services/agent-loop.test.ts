import { describe, expect, it, vi } from 'vitest'
import { createAgentLoop } from './agent-loop'

describe('agent loop', () => {
  it('runs a task through the task queue with registered tools and policy', async () => {
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
      execute: vi.fn(async () => ({ ok: true, output: { url: 'u' } })),
    }
    const loop = createAgentLoop({
      now: '2026-05-18T00:01:00.000Z',
      tasks: { updateTask },
      events: { addEvent },
      registry,
      policy: { autoRunLowRiskTasks: true },
    } as any)

    await loop.runTask({
      id: 'task_1',
      agentId: 'agent_1',
      type: 'generate_artifact',
      status: 'queued',
      title: '生成图片',
      summary: '生成图片。',
      inputJson: '{"toolName":"star.generateImage","input":{"prompt":"star"}}',
      createdAt: '2026-05-18T00:00:00.000Z',
      updatedAt: '2026-05-18T00:00:00.000Z',
    })

    expect(updateTask).toHaveBeenCalledWith('task_1', expect.objectContaining({ status: 'completed' }))
    expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'tool.completed' }))
  })

  it('plans tasks through the loop planner', () => {
    const loop = createAgentLoop({
      now: '2026-05-18T00:00:00.000Z',
      tasks: { updateTask: vi.fn() },
      events: { addEvent: vi.fn() },
      registry: { get: vi.fn(), execute: vi.fn() },
      policy: {},
    } as any)

    expect(loop.planTasks({
      observations: [
        { sourceType: 'chat', summary: '1', createdAt: '2026-05-18T00:00:00.000Z' },
        { sourceType: 'chat', summary: '2', createdAt: '2026-05-18T00:01:00.000Z' },
        { sourceType: 'chat', summary: '3', createdAt: '2026-05-18T00:02:00.000Z' },
      ],
      existingTasks: [],
    })).toMatchObject([{ type: 'sleep' }])
  })
})
