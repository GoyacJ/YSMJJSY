import { describe, expect, it } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createAgentInstanceRepository,
  createAgentEventRepository,
  createAgentEvolutionRepository,
  createAgentReflectionRepository,
  createAgentSnapshotRepository,
  createAgentSleepRepository,
  createAgentStateRepository,
  createAgentTaskRepository,
  createAgentWorkRepository,
  createAttachmentRepository,
  createConversationRepository,
  createKeyProfileRepository,
  createMediaTaskRepository,
  createMemoryEventRepository,
  createMemoryRepository,
  createUsageLimitRepository,
} from './sqlite'

describe('sqlite repositories', () => {
  it('creates and reuses an agent instance for a key binding', () => {
    const repo = createAgentInstanceRepository(':memory:')
    const now = '2026-05-18T00:00:00.000Z'

    const first = repo.getOrCreateAgentForOwner({
      ownerType: 'key',
      ownerId: 'key_1',
      domain: 'star',
      now,
    })
    const second = repo.getOrCreateAgentForOwner({
      ownerType: 'key',
      ownerId: 'key_1',
      domain: 'star',
      now: '2026-05-18T00:01:00.000Z',
    })

    expect(first.id).toBe(second.id)
    expect(first.status).toBe('active')
    expect(second.ownerId).toBe('key_1')
  })

  it('keeps separate agent bindings for separate keys', () => {
    const repo = createAgentInstanceRepository(':memory:')
    const now = '2026-05-18T00:00:00.000Z'

    const one = repo.getOrCreateAgentForOwner({ ownerType: 'key', ownerId: 'key_1', domain: 'star', now })
    const two = repo.getOrCreateAgentForOwner({ ownerType: 'key', ownerId: 'key_2', domain: 'star', now })

    expect(one.id).not.toBe(two.id)
  })

  it('stores and updates agent tasks by agent id', () => {
    const repo = createAgentTaskRepository(':memory:')
    repo.addTask({
      id: 'task_1',
      agentId: 'agent_1',
      type: 'reflect',
      status: 'queued',
      title: '整理最近对话',
      summary: '提炼最近对话。',
      inputJson: '{"source":"chat"}',
      resultJson: null,
      error: null,
      createdAt: '2026-05-18T00:00:00.000Z',
      updatedAt: '2026-05-18T00:00:00.000Z',
    })

    repo.updateTask('task_1', {
      status: 'completed',
      resultJson: '{"summary":"完成"}',
      updatedAt: '2026-05-18T00:01:00.000Z',
    })

    expect(repo.listTasksByAgent('agent_1')).toMatchObject([
      { id: 'task_1', status: 'completed', resultJson: '{"summary":"完成"}' },
    ])
  })

  it('records agent events by agent id', () => {
    const repo = createAgentEventRepository(':memory:')
    repo.addEvent({
      id: 'event_1',
      agentId: 'agent_1',
      type: 'task.completed',
      title: '任务完成',
      summary: '整理完成。',
      targetType: 'task',
      targetId: 'task_1',
      payloadJson: '{}',
      visibility: 'private',
      createdAt: '2026-05-18T00:00:00.000Z',
    })

    expect(repo.listEventsByAgent('agent_1')).toMatchObject([
      { id: 'event_1', type: 'task.completed', visibility: 'private' },
    ])
  })

  it('creates a default agent state for a key', () => {
    const repo = createAgentStateRepository(':memory:')

    const state = repo.getOrCreateAgentState('key_1', '2026-05-17T00:00:00.000Z')

    expect(state).toMatchObject({
      keyId: 'key_1',
      tone: '克制、温柔、安静',
      relationshipRole: '记忆星球守护者',
      learningMode: 'assisted',
      contentStrategy: {
        replyLength: 'balanced',
        structure: 'plain',
        initiative: 'low',
      },
    })
  })

  it('updates agent runtime state without changing unrelated fields', () => {
    const repo = createAgentStateRepository(':memory:')

    repo.getOrCreateAgentState('key_1', '2026-05-17T00:00:00.000Z')
    repo.updateAgentState('key_1', {
      tone: '更短',
      updatedAt: '2026-05-17T00:01:00.000Z',
    })

    expect(repo.getAgentState('key_1')).toMatchObject({
      keyId: 'key_1',
      tone: '更短',
      relationshipRole: '记忆星球守护者',
    })
  })

  it('stores and lists agent sleep runs by key', () => {
    const repo = createAgentSleepRepository(':memory:')

    repo.addSleepRun({
      id: 'sleep_1',
      keyId: 'key_1',
      status: 'completed',
      summary: '整理完成。',
      rawJson: '{}',
      startedAt: '2026-05-17T00:00:00.000Z',
      completedAt: '2026-05-17T00:01:00.000Z',
      error: null,
    })

    expect(repo.listSleepRunsByKey('key_1')[0]).toMatchObject({
      id: 'sleep_1',
      summary: '整理完成。',
    })
  })

  it('stores parsed sleep report fields', () => {
    const repo = createAgentSleepRepository(':memory:')

    repo.addSleepRun({
      id: 'sleep_1',
      keyId: 'key_1',
      status: 'completed',
      summary: '整理完成。',
      rawJson: '{}',
      memoryActionsJson: '[{"memoryId":"m1","action":"confirm","reason":"明确表达"}]',
      workIdeasJson: '[{"type":"letter","title":"短句回信","summary":"写一封短信"}]',
      nextConversationHintsJson: '["承接短句偏好"]',
      startedAt: '2026-05-18T00:00:00.000Z',
      completedAt: '2026-05-18T00:01:00.000Z',
      error: null,
    })

    expect(repo.getLatestSleepRunByKey('key_1')?.memoryActionsJson).toContain('confirm')
  })

  it('stores private agent works by key', () => {
    const repo = createAgentWorkRepository(':memory:')

    repo.addWork({
      id: 'work_1',
      keyId: 'key_1',
      type: 'image',
      title: '月光图',
      summary: '一张月光星空。',
      sourceConversationId: 'c1',
      sourceMediaTaskId: null,
      sourceDesignVersion: null,
      previewUrl: 'data:image/png;base64,abc',
      payloadJson: '{}',
      visibility: 'private',
      createdAt: '2026-05-17T00:00:00.000Z',
      updatedAt: '2026-05-17T00:00:00.000Z',
    })

    expect(repo.listWorksByKey('key_1')[0]).toMatchObject({
      id: 'work_1',
      type: 'image',
      visibility: 'private',
    })
  })

  it('stores and reads memories', () => {
    const repo = createMemoryRepository(':memory:')

    repo.addMemory({
      id: 'm1',
      type: 'emotion',
      content: '她喜欢星空部分',
      importance: 0.8,
      confidence: 0.9,
      sourceConversationId: 'c1',
      sourceAttachmentId: 'a1',
      status: 'active',
      updatedAt: '2026-05-15T00:01:00.000Z',
      createdAt: '2026-05-15T00:00:00.000Z',
    })

    expect(repo.listMemories()[0]).toMatchObject({
      confidence: 0.9,
      sourceConversationId: 'c1',
      sourceAttachmentId: 'a1',
      status: 'active',
      updatedAt: '2026-05-15T00:01:00.000Z',
    })
  })

  it('records memory governance events', () => {
    const repo = createMemoryEventRepository(':memory:')

    repo.addMemoryEvent({
      id: 'event_1',
      keyId: 'key_1',
      memoryId: 'memory_1',
      action: 'archive',
      beforeJson: '{"status":"active"}',
      afterJson: '{"status":"archived"}',
      reason: '用户要求不再使用。',
      createdAt: '2026-05-17T00:00:00.000Z',
    })

    expect(repo.listMemoryEventsByKey('key_1')[0]).toMatchObject({
      memoryId: 'memory_1',
      action: 'archive',
    })
  })

  it('creates and finds a key profile by lookup hash', () => {
    const repo = createKeyProfileRepository(':memory:')

    repo.addKeyProfile({
      id: 'key_1',
      keyLookupHash: 'lookup',
      assistantName: '',
      mbti: '',
      configuredAt: null,
      createdIpHash: 'ip_hash',
      createdAt: '2026-05-16T00:00:00.000Z',
      updatedAt: '2026-05-16T00:00:00.000Z',
    })

    expect(repo.findByLookupHash('lookup')?.id).toBe('key_1')
  })

  it('lists configured public stars without private key fields', () => {
    const repo = createKeyProfileRepository(':memory:')

    repo.addKeyProfile({
      id: 'key_1',
      keyLookupHash: 'lookup_1',
      assistantName: '阿月',
      mbti: 'INTJ',
      configuredAt: '2026-05-16T00:00:00.000Z',
      createdIpHash: 'ip_hash_1',
      createdAt: '2026-05-16T00:00:00.000Z',
      updatedAt: '2026-05-16T00:00:00.000Z',
      activityAt: '2026-05-16T00:01:00.000Z',
      activityKind: 'created',
    })
    repo.addKeyProfile({
      id: 'key_2',
      keyLookupHash: 'lookup_2',
      assistantName: '',
      mbti: '',
      configuredAt: null,
      createdIpHash: 'ip_hash_2',
      createdAt: '2026-05-16T00:02:00.000Z',
      updatedAt: '2026-05-16T00:02:00.000Z',
      activityAt: null,
      activityKind: null,
    })

    expect(repo.listPublicStars()).toEqual([
      {
        id: 'key_1',
        name: '阿月',
        mbti: 'INTJ',
        createdAt: '2026-05-16T00:00:00.000Z',
        activityAt: '2026-05-16T00:01:00.000Z',
        activityKind: 'created',
      },
    ])
  })

  it('marks key activity for public star flashes', () => {
    const repo = createKeyProfileRepository(':memory:')

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

    repo.markKeyActivity('key_1', {
      activityAt: '2026-05-16T00:03:00.000Z',
      activityKind: 'chat',
    })

    expect(repo.listPublicStars()[0]).toMatchObject({
      id: 'key_1',
      activityAt: '2026-05-16T00:03:00.000Z',
      activityKind: 'chat',
    })
  })

  it('stores usage limits by key and date', () => {
    const repo = createUsageLimitRepository(':memory:')

    repo.incrementUsage({
      keyId: 'key_1',
      ipHash: 'ip_hash',
      date: '2026-05-16',
      bucket: 'chat',
    })

    expect(repo.getUsage('key_1', '2026-05-16')?.chatCount).toBe(1)
  })

  it('lists recent conversations by key only', () => {
    const repo = createConversationRepository(':memory:')

    repo.addConversation({
      id: 'c1',
      keyId: 'key_1',
      role: 'user',
      content: 'key 1',
      createdAt: '2026-05-16T00:00:00.000Z',
    })
    repo.addConversation({
      id: 'c2',
      keyId: 'key_2',
      role: 'user',
      content: 'key 2',
      createdAt: '2026-05-16T00:01:00.000Z',
    })

    expect(repo.listRecentConversationsByKey('key_1').map(item => item.content)).toEqual(['key 1'])
  })

  it('gets a conversation by key and id', () => {
    const repo = createConversationRepository(':memory:')

    repo.addConversation({
      id: 'c1',
      keyId: 'key_1',
      role: 'user',
      content: '用户说自己喜欢短句，这段内容只用于私有来源摘要。',
      createdAt: '2026-05-17T00:00:00.000Z',
    })

    expect(repo.getConversationByKey('key_1', 'c1')).toMatchObject({
      id: 'c1',
      content: '用户说自己喜欢短句，这段内容只用于私有来源摘要。',
    })
    expect(repo.getConversationByKey('key_2', 'c1')).toBeUndefined()
  })

  it('stores structured conversation message json', () => {
    const repo = createConversationRepository(':memory:')

    repo.addConversation({
      id: 'c1',
      keyId: 'key_1',
      role: 'assistant',
      content: '生成好了。',
      messageJson: JSON.stringify({
        role: 'assistant',
        content: '生成好了。',
        parts: [{ type: 'image', base64: 'img' }],
      }),
      createdAt: '2026-05-16T00:00:00.000Z',
    })

    expect(repo.listRecentConversationsByKey('key_1')[0]?.messageJson).toContain('"image"')
  })

  it('lists memories by key only', () => {
    const repo = createMemoryRepository(':memory:')

    repo.addMemory({
      id: 'm1',
      keyId: 'key_1',
      type: 'emotion',
      content: 'key 1 memory',
      importance: 0.8,
      createdAt: '2026-05-16T00:00:00.000Z',
    })
    repo.addMemory({
      id: 'm2',
      keyId: 'key_2',
      type: 'emotion',
      content: 'key 2 memory',
      importance: 0.8,
      createdAt: '2026-05-16T00:00:00.000Z',
    })

    expect(repo.listMemoriesByKey('key_1').map(item => item.content)).toEqual(['key 1 memory'])
  })

  it('stores agent reflections by key', () => {
    const repo = createAgentReflectionRepository(':memory:')

    repo.addReflection({
      id: 'reflection_1',
      keyId: 'key_1',
      conversationId: 'c1',
      summary: '用户更喜欢短句。',
      rawJson: '{"summary":"用户更喜欢短句。"}',
      createdAt: '2026-05-17T00:00:00.000Z',
    })
    repo.addReflection({
      id: 'reflection_2',
      keyId: 'key_2',
      conversationId: 'c2',
      summary: '另一个 key。',
      rawJson: '{}',
      createdAt: '2026-05-17T00:01:00.000Z',
    })

    expect(repo.listReflectionsByKey('key_1')).toEqual([
      {
        id: 'reflection_1',
        keyId: 'key_1',
        conversationId: 'c1',
        summary: '用户更喜欢短句。',
        rawJson: '{"summary":"用户更喜欢短句。"}',
        createdAt: '2026-05-17T00:00:00.000Z',
      },
    ])
  })

  it('stores, lists, and updates agent evolution proposals', () => {
    const repo = createAgentEvolutionRepository(':memory:')

    repo.addProposal({
      id: 'proposal_1',
      keyId: 'key_1',
      reflectionId: 'reflection_1',
      type: 'tone',
      title: '更克制',
      summary: '回复更短。',
      payloadJson: '{"tone":"concise"}',
      status: 'pending',
      createdAt: '2026-05-17T00:00:00.000Z',
      updatedAt: '2026-05-17T00:00:00.000Z',
    })

    repo.updateProposal('proposal_1', {
      status: 'accepted',
      updatedAt: '2026-05-17T00:02:00.000Z',
    })

    expect(repo.listProposalsByKey('key_1')).toEqual([
      {
        id: 'proposal_1',
        keyId: 'key_1',
        reflectionId: 'reflection_1',
        type: 'tone',
        title: '更克制',
        summary: '回复更短。',
        payloadJson: '{"tone":"concise"}',
        status: 'accepted',
        createdAt: '2026-05-17T00:00:00.000Z',
        updatedAt: '2026-05-17T00:02:00.000Z',
      },
    ])
  })

  it('stores agent state snapshots by key', () => {
    const repo = createAgentSnapshotRepository(':memory:')

    repo.addSnapshot({
      id: 'snapshot_1',
      keyId: 'key_1',
      proposalId: 'proposal_1',
      profileJson: '{"tone":"concise"}',
      createdAt: '2026-05-17T00:00:00.000Z',
    })
    repo.addSnapshot({
      id: 'snapshot_2',
      keyId: 'key_2',
      proposalId: 'proposal_2',
      profileJson: '{}',
      createdAt: '2026-05-17T00:01:00.000Z',
    })

    expect(repo.listSnapshotsByKey('key_1')).toEqual([
      {
        id: 'snapshot_1',
        keyId: 'key_1',
        proposalId: 'proposal_1',
        profileJson: '{"tone":"concise"}',
        createdAt: '2026-05-17T00:00:00.000Z',
      },
    ])
  })

  it('gets media tasks by key only', () => {
    const repo = createMediaTaskRepository(':memory:')

    repo.addMediaTask({
      id: 'task_1',
      keyId: 'key_1',
      type: 'video',
      providerTaskId: null,
      status: 'pending',
      prompt: 'star',
      resultUrl: null,
      error: null,
      createdAt: '2026-05-16T00:00:00.000Z',
      updatedAt: '2026-05-16T00:00:00.000Z',
    })

    expect(repo.getMediaTaskByKey('key_1', 'task_1')?.id).toBe('task_1')
    expect(repo.getMediaTaskByKey('key_2', 'task_1')).toBeUndefined()
  })

  it('stores attachments by key and conversation', () => {
    const path = join(tmpdir(), `ysmjjsy-attachment-${Date.now()}-${Math.random()}.sqlite`)
    const profiles = createKeyProfileRepository(path)
    const repo = createAttachmentRepository(path)

    profiles.addKeyProfile({
      id: 'key_1',
      keyLookupHash: 'lookup_attachment',
      assistantName: '',
      mbti: '',
      configuredAt: null,
      createdIpHash: 'ip_hash',
      createdAt: '2026-05-16T00:00:00.000Z',
      updatedAt: '2026-05-16T00:00:00.000Z',
    })
    repo.addAttachment({
      id: 'att_1',
      keyId: 'key_1',
      conversationId: 'c1',
      type: 'audio',
      mimeType: 'audio/mpeg',
      filename: 'voice.mp3',
      dataUrl: 'data:audio/mpeg;base64,abc',
      createdAt: '2026-05-16T00:00:00.000Z',
    })

    expect(repo.listAttachmentsByConversation('key_1', 'c1')).toHaveLength(1)
    expect(repo.listAttachmentsByConversation('key_2', 'c1')).toHaveLength(0)
  })
})
