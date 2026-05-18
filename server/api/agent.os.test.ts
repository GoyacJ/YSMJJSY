import { describe, expect, it, vi } from 'vitest'
import { approveAgentInboxItem } from './agents/current/inbox/[id]/approve.post'
import { rejectAgentInboxItem } from './agents/current/inbox/[id]/reject.post'
import { buildCurrentAgentResponse } from './agents/current.get'
import { buildAgentEventsResponse } from './agents/current/events.get'
import { buildAgentInboxResponse } from './agents/current/inbox.get'
import { buildCurrentAgentOsResponse } from './agents/current/os.get'
import { buildAgentTasksResponse, enqueueCurrentAgentTask } from './agents/current/tasks.post'
import { updateCurrentAgentTask } from './agents/current/tasks/[id].put'

describe('agent os api helpers', () => {
  const forbiddenResponseSubstrings = [
    'keyLookupHash',
    'createdIpHash',
    'session',
    'payloadJson',
    'rawJson',
    'data:image',
    'data:audio',
    'rawProviderBody',
  ]

  function expectNoForbiddenResponseSubstrings(value: unknown) {
    const serialized = JSON.stringify(value)

    for (const forbidden of forbiddenResponseSubstrings) {
      expect(serialized).not.toContain(forbidden)
    }
  }

  it('builds current agent metadata responses', () => {
    const result = buildCurrentAgentResponse({
      keyId: 'key_1',
      now: '2026-05-18T00:00:00.000Z',
      agents: {
        getOrCreateAgentForOwner: () => ({
          id: 'agent_1',
          status: 'active',
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
          bindingId: 'binding_1',
          ownerType: 'key',
          ownerId: 'key_1',
          domain: 'star',
        }),
      },
    })

    expect(result.agent).toMatchObject({ id: 'agent_1', ownerId: 'key_1' })
  })

  it('builds safe agent task list responses', () => {
    const result = buildAgentTasksResponse({
      tasks: {
        listTasksByAgent: () => [{
          id: 'task_1',
          agentId: 'agent_1',
          type: 'sleep',
          status: 'queued',
          title: '睡眠整理',
          summary: '整理。',
          inputJson: '{"secret":true}',
          resultJson: JSON.stringify({
            title: '整理完成',
            keyLookupHash: 'lookup',
            rawJson: { provider: true },
            rawProviderBody: 'provider body',
            previewUrl: 'data:image/png;base64,abc',
          }),
          error: null,
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
        }],
      },
      agentId: 'agent_1',
    })

    expect(JSON.stringify(result)).not.toContain('secret')
    expectNoForbiddenResponseSubstrings(result)
    expect(result.tasks[0]).toMatchObject({ id: 'task_1', status: 'queued' })
  })

  it('enqueues current agent tasks', () => {
    const addTask = vi.fn()
    const addEvent = vi.fn()
    const result = enqueueCurrentAgentTask({
      agentId: 'agent_1',
      now: '2026-05-18T00:00:00.000Z',
      body: { type: 'sleep', input: { keyId: 'key_1' } },
      tasks: { addTask },
      events: { addEvent },
    })

    expect(result.task.status).toBe('queued')
    expect(addTask).toHaveBeenCalled()
    expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'task.queued' }))
  })

  it('runs task update actions', async () => {
    const updateTask = vi.fn()
    const task = {
      id: 'task_1',
      agentId: 'agent_1',
      type: 'sleep',
      status: 'queued',
      title: '睡眠整理',
      summary: '整理。',
      inputJson: '{}',
      resultJson: null,
      error: null,
      createdAt: '2026-05-18T00:00:00.000Z',
      updatedAt: '2026-05-18T00:00:00.000Z',
    }

    await updateCurrentAgentTask({
      agentId: 'agent_1',
      taskId: 'task_1',
      now: '2026-05-18T00:01:00.000Z',
      body: { action: 'cancel' },
      tasks: {
        getTask: () => task,
        updateTask,
      },
      events: { addEvent: vi.fn() },
      registry: { get: vi.fn(), execute: vi.fn() },
    } as any)

    expect(updateTask).toHaveBeenCalledWith('task_1', expect.objectContaining({ status: 'cancelled' }))
  })

  it('builds standalone inbox list responses', () => {
    const result = buildAgentInboxResponse({
      pendingProposals: [],
      publicWorkCandidates: [{
        id: 'work_1',
        keyId: 'key_1',
        type: 'image',
        title: '月光图',
        summary: '一张图。',
        payloadJson: '{"raw":true}',
        visibility: 'private',
        createdAt: '2026-05-18T00:00:00.000Z',
        updatedAt: '2026-05-18T00:00:00.000Z',
      }],
    })

    expect(result.inbox).toMatchObject([{ id: 'work_visibility:work_1' }])
    expect(JSON.stringify(result)).not.toContain('raw')
    expectNoForbiddenResponseSubstrings(result)
  })

  it('builds safe agent event list responses without payload json', () => {
    const result = buildAgentEventsResponse({
      events: {
        listEventsByAgent: () => [{
          id: 'event_1',
          agentId: 'agent_1',
          type: 'provider.failed',
          title: 'Provider failed',
          summary: '模型失败。',
          payloadJson: '{"raw":"secret"}',
          visibility: 'private',
          createdAt: '2026-05-18T00:00:00.000Z',
        }],
      },
      agentId: 'agent_1',
    })

    expect(JSON.stringify(result)).not.toContain('secret')
    expectNoForbiddenResponseSubstrings(result)
  })

  it('returns os state for the current key agent', () => {
    const result = buildCurrentAgentOsResponse({
      keyId: 'key_1',
      now: '2026-05-18T00:00:00.000Z',
      agents: {
        getOrCreateAgentForOwner: () => ({
          id: 'agent_1',
          status: 'active',
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
          bindingId: 'binding_1',
          ownerType: 'key',
          ownerId: 'key_1',
          domain: 'star',
        }),
      },
      tasks: { listTasksByAgent: () => [] },
      events: { listEventsByAgent: () => [] },
      proposals: { listProposalsByKey: () => [] },
      works: { listWorksByKey: () => [] },
    })

    expect(result.agent).toMatchObject({ id: 'agent_1', ownerId: 'key_1' })
    expectNoForbiddenResponseSubstrings(result)
  })

  it('approves proposal inbox items through proposal actions and writes an event', () => {
    const updateProposal = vi.fn()
    const addEvent = vi.fn()

    expect(approveAgentInboxItem({
      itemId: 'proposal:proposal_1',
      keyId: 'key_1',
      agentId: 'agent_1',
      now: '2026-05-18T00:00:00.000Z',
      profile: { assistantName: '月光', mbti: 'INTJ' },
      agentState: {
        tone: '克制、温柔、安静',
        relationshipRole: '记忆星球守护者',
        learningMode: 'assisted',
        contentStrategy: {},
      },
      proposals: {
        listProposalsByKey: () => [{
          id: 'proposal_1',
          keyId: 'key_1',
          type: 'tone',
          title: '更短',
          summary: '回复更短。',
          payloadJson: JSON.stringify({ tone: '更短' }),
          status: 'pending',
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
        }],
        updateProposal,
      },
      snapshots: { addSnapshot: vi.fn() },
      states: { updateAgentState: vi.fn() },
      memories: { updateMemory: vi.fn() },
      works: {
        getWorkByKey: vi.fn(),
        updateWorkVisibility: vi.fn(),
      },
      events: { addEvent },
    })).toEqual({ id: 'proposal_1', type: 'proposal', status: 'applied' })

    expect(updateProposal).toHaveBeenCalledWith('proposal_1', {
      status: 'applied',
      updatedAt: '2026-05-18T00:00:00.000Z',
    })
    expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'approval.approved',
      targetType: 'proposal',
      targetId: 'proposal_1',
    }))
  })

  it('rejects proposal inbox items through proposal actions and writes an event', () => {
    const updateProposal = vi.fn()
    const addEvent = vi.fn()

    expect(rejectAgentInboxItem({
      itemId: 'proposal:proposal_1',
      keyId: 'key_1',
      agentId: 'agent_1',
      now: '2026-05-18T00:00:00.000Z',
      profile: { assistantName: '月光', mbti: 'INTJ' },
      agentState: {
        tone: '克制、温柔、安静',
        relationshipRole: '记忆星球守护者',
        learningMode: 'assisted',
        contentStrategy: {},
      },
      proposals: {
        listProposalsByKey: () => [{
          id: 'proposal_1',
          keyId: 'key_1',
          type: 'tone',
          title: '更短',
          summary: '回复更短。',
          payloadJson: '{}',
          status: 'pending',
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
        }],
        updateProposal,
      },
      snapshots: { addSnapshot: vi.fn() },
      states: { updateAgentState: vi.fn() },
      memories: { updateMemory: vi.fn() },
      works: {
        getWorkByKey: vi.fn(),
        updateWorkVisibility: vi.fn(),
      },
      events: { addEvent },
    })).toEqual({ id: 'proposal_1', type: 'proposal', status: 'rejected' })

    expect(updateProposal).toHaveBeenCalledWith('proposal_1', {
      status: 'rejected',
      updatedAt: '2026-05-18T00:00:00.000Z',
    })
    expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'approval.rejected',
      targetType: 'proposal',
      targetId: 'proposal_1',
    }))
  })

  it('approves work visibility inbox items and writes an event', () => {
    const updateWorkVisibility = vi.fn()
    const addEvent = vi.fn()
    const works = {
      getWorkByKey: () => ({
        id: 'work_1',
        keyId: 'key_1',
        type: 'image',
        title: '月光图',
        summary: '一张图。',
        payloadJson: '{}',
        visibility: 'private',
        createdAt: '2026-05-18T00:00:00.000Z',
        updatedAt: '2026-05-18T00:00:00.000Z',
      }),
      updateWorkVisibility,
    }

    expect(approveAgentInboxItem({
      itemId: 'work_visibility:work_1',
      keyId: 'key_1',
      agentId: 'agent_1',
      now: '2026-05-18T00:00:00.000Z',
      profile: { assistantName: '月光', mbti: 'INTJ' },
      agentState: {
        tone: '克制、温柔、安静',
        relationshipRole: '记忆星球守护者',
        learningMode: 'assisted',
        contentStrategy: {},
      },
      proposals: {
        listProposalsByKey: () => [],
        updateProposal: vi.fn(),
      },
      snapshots: { addSnapshot: vi.fn() },
      states: { updateAgentState: vi.fn() },
      memories: { updateMemory: vi.fn() },
      works,
      events: { addEvent },
    })).toEqual({ id: 'work_1', type: 'work_visibility', status: 'approved' })

    expect(updateWorkVisibility).toHaveBeenCalledWith('key_1', 'work_1', 'public', '2026-05-18T00:00:00.000Z')
    expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'approval.approved',
      targetType: 'work',
      targetId: 'work_1',
    }))
  })

  it('approves rollback inbox items by restoring the snapshot', () => {
    const updateAgentState = vi.fn()
    const addEvent = vi.fn()

    expect(approveAgentInboxItem({
      itemId: 'rollback:snapshot_1',
      keyId: 'key_1',
      agentId: 'agent_1',
      now: '2026-05-18T00:00:00.000Z',
      profile: { assistantName: '月光', mbti: 'INTJ' },
      agentState: {
        tone: '当前',
        relationshipRole: '当前关系',
        learningMode: 'assisted',
        contentStrategy: {},
      },
      proposals: {
        listProposalsByKey: () => [],
        updateProposal: vi.fn(),
      },
      snapshots: {
        addSnapshot: vi.fn(),
        getSnapshotByKey: () => ({
          id: 'snapshot_1',
          keyId: 'key_1',
          proposalId: 'proposal_1',
          profileJson: JSON.stringify({
            agentState: {
              tone: '旧语气',
              relationshipRole: '旧关系',
              learningMode: 'manual',
              contentStrategy: { replyLength: 'short' },
            },
          }),
          createdAt: '2026-05-18T00:00:00.000Z',
        }),
      },
      states: { updateAgentState },
      memories: { updateMemory: vi.fn() },
      works: {
        getWorkByKey: vi.fn(),
        updateWorkVisibility: vi.fn(),
      },
      events: { addEvent },
    } as any)).toEqual({ id: 'snapshot_1', type: 'rollback', status: 'restored' })

    expect(updateAgentState).toHaveBeenCalledWith('key_1', expect.objectContaining({
      tone: '旧语气',
      relationshipRole: '旧关系',
      learningMode: 'manual',
    }))
    expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'approval.approved',
      targetType: 'snapshot',
      targetId: 'snapshot_1',
    }))
  })
})
