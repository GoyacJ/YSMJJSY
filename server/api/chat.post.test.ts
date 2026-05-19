import { describe, expect, it, vi } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildStarChatSleepRunner, buildStoredAssistantMessage, buildUserMessageJson, buildWorksFromAssistantMessage, recordChatObservations, resolveStarChatAgentPolicy, runAgentLearning, scheduleAgentSleepAfterChat, selectRecentStarChatToolNames } from './chat/stream.post'
import { defaultStarBoundarySettings } from '../db/sqlite'
import { buildStarChatMessages, chatBodySchema, starChatStreamEventSchema } from '../services/star-chat'

describe('chat api helpers', () => {
  it('derives chat tool execution policy from profile boundary settings', () => {
    const policy = resolveStarChatAgentPolicy({
      boundarySettings: {
        ...defaultStarBoundarySettings,
        requireApprovalForPublishing: false,
        requireApprovalForSensitiveMemory: false,
        disallowedMemoryTopics: ['secret'],
      },
    })

    expect(policy.requireApprovalForPublishing).toBe(false)
    expect(policy.requireApprovalForSensitiveMemory).toBe(false)
    expect(policy.disallowedMemoryTopics).toEqual(['secret'])
  })

  it('accepts chat tool stream events', () => {
    expect(starChatStreamEventSchema.parse({ type: 'tool-status', text: '正在准备工具。', visibility: 'user' })).toEqual({
      type: 'tool-status',
      text: '正在准备工具。',
      visibility: 'user',
    })
    expect(starChatStreamEventSchema.parse({ type: 'tool-status', text: 'raw error', visibility: 'debug' })).toEqual({
      type: 'tool-status',
      text: 'raw error',
      visibility: 'debug',
    })
    expect(starChatStreamEventSchema.parse({
      type: 'tool-confirmation',
      taskId: 'task_1',
      inboxItemId: 'task_approval:task_1',
      title: '发布作品',
      summary: '发布前需要确认。',
    })).toEqual({
      type: 'tool-confirmation',
      taskId: 'task_1',
      inboxItemId: 'task_approval:task_1',
      title: '发布作品',
      summary: '发布前需要确认。',
    })
  })

  it('builds a runnable sleep tool context for chat tools', async () => {
    const addSleepRun = vi.fn()
    const updateSleepRun = vi.fn()
    const addReflection = vi.fn()
    const updateAgentState = vi.fn()
    const runner = buildStarChatSleepRunner({
      keyId: 'key_1',
      now: '2026-05-19T00:00:00.000Z',
      client: {
        reflect: vi.fn(async () => JSON.stringify({
          dailySummary: '整理完成。',
          memoryActions: [],
          proposals: [],
          workIdeas: [],
          nextConversationHints: [],
        })),
      },
      profile: { assistantName: '星信', mbti: 'INTJ' },
      agentState: { tone: '克制', relationshipRole: '守护者' },
      memories: { listMemoriesByKey: vi.fn(() => []) },
      conversations: { listRecentConversationsByKey: vi.fn(() => []) },
      reflections: {
        listReflectionsByKey: vi.fn(() => []),
        addReflection,
      },
      proposals: { addProposal: vi.fn() },
      sleeps: { addSleepRun, updateSleepRun },
      states: { updateAgentState },
    })

    await expect(runner({})).resolves.toMatchObject({
      run: {
        keyId: 'key_1',
        status: 'completed',
        summary: '整理完成。',
      },
    })
    expect(addSleepRun).toHaveBeenCalled()
    expect(updateSleepRun).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status: 'completed' }))
    expect(addReflection).toHaveBeenCalledWith(expect.objectContaining({ summary: '整理完成。' }))
    expect(updateAgentState).toHaveBeenCalledWith('key_1', expect.objectContaining({ lastSleepAt: '2026-05-19T00:00:00.000Z' }))
  })

  it('strips removed compatibility routing fields from chat requests', () => {
    expect(chatBodySchema.parse({
      message: '画一张星空',
      intent: 'image',
      imageDataUrl: 'data:image/png;base64,abc',
    })).toEqual({
      message: '画一张星空',
      attachments: [],
    })
  })

  it('stores user attachment message parts as attachment references', () => {
    const message = buildUserMessageJson('看这个', [{
      kind: 'image',
      attachmentId: 'att_1',
      url: '/api/attachments/att_1',
    }])

    expect(JSON.stringify(message)).not.toContain('data:image')
    expect(message.parts[1]).toEqual({
      type: 'image',
      url: '/api/attachments/att_1',
      attachmentId: 'att_1',
    })
  })

  it('selects recent chat tool names from agent tasks', () => {
    expect(selectRecentStarChatToolNames([
      { inputJson: JSON.stringify({ toolName: 'star.generateMusic', input: { prompt: '歌' } }) },
      { inputJson: JSON.stringify({ toolName: 'star.generateImage', input: { prompt: '封面' } }) },
      { inputJson: JSON.stringify({ toolName: 'star.generateMusic', input: { prompt: '歌' } }) },
      { inputJson: 'not json' },
    ])).toEqual(['star.generateMusic', 'star.generateImage'])
  })

  it('stores assistant inline media as attachment references', () => {
    const addAttachment = vi.fn()
    const message = buildStoredAssistantMessage({
      keyId: 'key_1',
      conversationId: 'conversation_1',
      now: '2026-05-19T00:00:00.000Z',
      message: {
        role: 'assistant',
        content: '画好了。',
        parts: [{ type: 'image', base64: 'abc' }],
      },
      blobRoot: join(tmpdir(), `ysmjjsy-chat-blob-${Date.now()}-${Math.random()}`),
      attachments: { addAttachment },
    })

    expect(JSON.stringify(message)).not.toContain('abc')
    expect(message.parts[0]).toMatchObject({
      type: 'image',
      url: expect.stringMatching(/^\/api\/attachments\//),
      attachmentId: expect.any(String),
    })
    expect(addAttachment).toHaveBeenCalledWith(expect.objectContaining({
      keyId: 'key_1',
      conversationId: 'conversation_1',
      type: 'image',
      dataUrl: expect.stringMatching(/^blob:/),
    }))
  })

  it('records chat observations for user and assistant messages', () => {
    const addObservation = vi.fn()
    const addEvent = vi.fn()

    recordChatObservations({
      agentId: 'agent_1',
      userConversationId: 'user_1',
      assistantConversationId: 'assistant_1',
      userSummary: '用户发送消息。',
      assistantSummary: '助手完成回复。',
      now: '2026-05-18T00:00:00.000Z',
      observations: { addObservation },
      events: { addEvent },
    })

    expect(addObservation).toHaveBeenCalledTimes(2)
    expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'observation.created' }))
  })

  it('maps assistant media message parts to agent works', () => {
    const works = buildWorksFromAssistantMessage({
      keyId: 'key_1',
      conversationId: 'assistant_1',
      now: '2026-05-17T00:00:00.000Z',
      message: {
        role: 'assistant',
        content: '画好了。',
        parts: [{ type: 'image', url: 'https://example.com/moon.png' }],
      },
    })

    expect(works[0]).toMatchObject({
      type: 'image',
      title: '画好了。',
      previewUrl: 'https://example.com/moon.png',
      visibility: 'private',
    })
    expect(JSON.parse(works[0].payloadJson)).toMatchObject({
      type: 'image',
      disclosure: {
        aiGenerated: true,
        explicitLabel: 'AI 生成',
        generatedAt: '2026-05-17T00:00:00.000Z',
      },
    })
  })

  it('normalizes base64 media previews for agent works', () => {
    const works = buildWorksFromAssistantMessage({
      keyId: 'key_1',
      conversationId: 'assistant_1',
      now: '2026-05-17T00:00:00.000Z',
      message: {
        role: 'assistant',
        content: '生成好了。',
        parts: [
          { type: 'image', base64: 'img' },
          { type: 'music', base64: 'song' },
        ],
      },
    })

    expect(works.map(work => work.previewUrl)).toEqual([
      'data:image/png;base64,img',
      'data:audio/mpeg;base64,song',
    ])
  })

  it('maps a video task status message to a video work', () => {
    const works = buildWorksFromAssistantMessage({
      keyId: 'key_1',
      conversationId: 'assistant_1',
      now: '2026-05-17T00:00:00.000Z',
      taskId: 'task-1',
      message: {
        role: 'assistant',
        content: '视频开始生成了。',
        parts: [{ type: 'status', text: '视频开始生成了。' }],
      },
    })

    expect(works).toHaveLength(1)
    expect(works[0]).toMatchObject({
      type: 'video',
      title: '视频开始生成了。',
      sourceConversationId: 'assistant_1',
      sourceMediaTaskId: 'task-1',
      previewUrl: null,
      visibility: 'private',
    })
    expect(JSON.parse(works[0].payloadJson)).toMatchObject({
      taskId: 'task-1',
      parts: [{ type: 'status', text: '视频开始生成了。' }],
      disclosure: {
        aiGenerated: true,
        explicitLabel: 'AI 生成',
        generatedAt: '2026-05-17T00:00:00.000Z',
      },
    })
  })

  it('schedules the next agent sleep reminder after new chat content', () => {
    const updateAgentState = vi.fn()

    scheduleAgentSleepAfterChat({
      keyId: 'key_1',
      now: '2026-05-18T00:00:00.000Z',
      newConversationCount: 1,
      agentState: {
        lastSleepAt: null,
        nextSleepAt: null,
      },
      states: { updateAgentState },
    })

    expect(updateAgentState).toHaveBeenCalledWith('key_1', {
      nextSleepAt: '2026-05-18T12:00:00.000Z',
      updatedAt: '2026-05-18T00:00:00.000Z',
    })
  })

  it('includes persona, letter, memories, and user message', () => {
    const messages = buildStarChatMessages({
      userMessage: '这封信是真的吗？',
      assistantName: '星信',
      mbti: 'INTJ',
      memories: ['她喜欢星空'],
      recentConversation: [],
    })

    expect(JSON.stringify(messages)).toContain('星信')
    expect(JSON.stringify(messages)).toContain('MBTI 性格设定：INTJ')
    expect(JSON.stringify(messages)).toContain('这封信是真的吗')
    expect(JSON.stringify(messages)).toContain('她喜欢星空')
  })

  it('adds image descriptions to the user message context', () => {
    const messages = buildStarChatMessages({
      userMessage: '看看这张图',
      imageDescription: '图片里是一片星空。',
      attachmentNotes: [],
      assistantName: '星信',
      mbti: 'INTJ',
      memories: [],
      recentConversation: [],
    })

    expect(messages.at(-1)).toEqual({
      role: 'user',
      content: '看看这张图\n\n用户附带图片描述：图片里是一片星空。',
    })
  })

  it('adds audio and video attachment metadata to context', () => {
    const messages = buildStarChatMessages({
      userMessage: '看看附件',
      attachmentNotes: [
        '用户附带了一个音频文件：voice.mp3，类型 audio/mpeg。当前版本不直接解析该文件内容。',
        '用户附带了一个视频文件：clip.mp4，类型 video/mp4。当前版本不直接解析该文件内容。',
      ],
      assistantName: '星信',
      mbti: 'INTJ',
      memories: [],
      recentConversation: [],
    })

    expect(String(messages.at(-1)?.content)).toContain('voice.mp3')
    expect(String(messages.at(-1)?.content)).toContain('clip.mp4')
  })

  it('stores one reflection after a successful chat', async () => {
    const reflections: any[] = []

    await runAgentLearning({
      keyId: 'key_1',
      conversationId: 'c_assistant',
      userMessage: '我喜欢短句。',
      assistantReply: '好。',
      existingMemories: [],
      profile: { assistantName: '星信', mbti: 'INTJ' },
      client: {
        reflectAgent: vi.fn(async () => JSON.stringify({
          summary: '用户喜欢短句。',
          learned: [],
          proposals: [],
        })),
      },
      reflections: {
        addReflection: record => reflections.push(record),
      },
      memories: {
        addMemory: vi.fn(),
      },
      proposals: {
        addProposal: vi.fn(),
      },
    })

    expect(reflections).toHaveLength(1)
    expect(reflections[0]).toMatchObject({
      keyId: 'key_1',
      conversationId: 'c_assistant',
      summary: '用户喜欢短句。',
    })
  })

  it('stores learned memories under the current key', async () => {
    const memories: any[] = []

    await runAgentLearning({
      keyId: 'key_1',
      conversationId: 'c_assistant',
      userMessage: '我喜欢短句。',
      assistantReply: '好。',
      existingMemories: [],
      profile: { assistantName: '星信', mbti: 'INTJ' },
      client: {
        reflectAgent: vi.fn(async () => JSON.stringify({
          summary: '用户喜欢短句。',
          learned: [
            {
              shouldRemember: true,
              type: 'preference',
              content: '用户喜欢短句。',
              importance: 0.8,
              confidence: 0.9,
            },
          ],
          proposals: [],
        })),
      },
      reflections: {
        addReflection: vi.fn(),
      },
      memories: {
        addMemory: record => memories.push(record),
      },
      proposals: {
        addProposal: vi.fn(),
      },
    })

    expect(memories[0]).toMatchObject({
      keyId: 'key_1',
      sourceConversationId: 'c_assistant',
      type: 'preference',
      content: '用户喜欢短句。',
      confidence: 0.9,
      status: 'active',
    })
  })

  it('does not store learned memories similar to rejected memories', async () => {
    const memories: any[] = []

    await runAgentLearning({
      keyId: 'key_1',
      conversationId: 'c_assistant',
      userMessage: '我喜欢短句。',
      assistantReply: '好。',
      existingMemories: [],
      rejectedMemories: ['用户喜欢短句。'],
      profile: { assistantName: '星信', mbti: 'INTJ' },
      client: {
        reflectAgent: vi.fn(async () => JSON.stringify({
          summary: '用户喜欢短句。',
          learned: [
            {
              shouldRemember: true,
              type: 'preference',
              content: '用户喜欢短句。',
              importance: 0.8,
              confidence: 0.9,
            },
          ],
          proposals: [],
        })),
      },
      reflections: {
        addReflection: vi.fn(),
      },
      memories: {
        addMemory: record => memories.push(record),
      },
      proposals: {
        addProposal: vi.fn(),
      },
    })

    expect(memories).toHaveLength(0)
  })

  it('does not store learned memories that conflict with active memories', async () => {
    const memories: any[] = []

    await runAgentLearning({
      keyId: 'key_1',
      conversationId: 'c_assistant',
      userMessage: '我不喜欢长句。',
      assistantReply: '记下。',
      existingMemories: ['用户喜欢长句。'],
      profile: { assistantName: '星信', mbti: 'INTJ' },
      client: {
        reflectAgent: vi.fn(async () => JSON.stringify({
          summary: '用户修正长句偏好。',
          learned: [
            {
              shouldRemember: true,
              type: 'preference',
              content: '用户不喜欢长句。',
              importance: 0.8,
              confidence: 0.9,
            },
          ],
          proposals: [],
        })),
      },
      reflections: {
        addReflection: vi.fn(),
      },
      memories: {
        addMemory: record => memories.push(record),
      },
      proposals: {
        addProposal: vi.fn(),
      },
    })

    expect(memories).toHaveLength(0)
  })

  it('stores evolution proposals as pending', async () => {
    const proposals: any[] = []

    await runAgentLearning({
      keyId: 'key_1',
      conversationId: 'c_assistant',
      userMessage: '我喜欢短句。',
      assistantReply: '好。',
      existingMemories: [],
      profile: { assistantName: '星信', mbti: 'INTJ' },
      client: {
        reflectAgent: vi.fn(async () => JSON.stringify({
          summary: '用户喜欢短句。',
          learned: [],
          proposals: [
            {
              type: 'tone',
              title: '更短',
              summary: '回复更短。',
              payload: { tone: 'concise' },
            },
          ],
        })),
      },
      reflections: {
        addReflection: vi.fn(),
      },
      memories: {
        addMemory: vi.fn(),
      },
      proposals: {
        addProposal: record => proposals.push(record),
      },
    })

    expect(proposals[0]).toMatchObject({
      keyId: 'key_1',
      reflectionId: expect.any(String),
      type: 'tone',
      status: 'pending',
      payloadJson: '{"tone":"concise"}',
    })
  })

  it('swallows learning failures after the chat reply', async () => {
    await expect(runAgentLearning({
      keyId: 'key_1',
      conversationId: 'c_assistant',
      userMessage: '你好',
      assistantReply: '你好。',
      existingMemories: [],
      profile: { assistantName: '星信', mbti: 'INTJ' },
      client: {
        reflectAgent: vi.fn(async () => {
          throw new Error('reflection failed')
        }),
      },
      reflections: {
        addReflection: vi.fn(),
      },
      memories: {
        addMemory: vi.fn(),
      },
      proposals: {
        addProposal: vi.fn(),
      },
    })).resolves.toBeUndefined()
  })

  it('swallows learning failure reporting failures after the chat reply', async () => {
    await expect(runAgentLearning({
      keyId: 'key_1',
      conversationId: 'c_assistant',
      userMessage: '你好',
      assistantReply: '你好。',
      existingMemories: [],
      profile: { assistantName: '星信', mbti: 'INTJ' },
      client: {
        reflectAgent: vi.fn(async () => {
          throw new Error('reflection failed')
        }),
      },
      reflections: {
        addReflection: vi.fn(),
      },
      memories: {
        addMemory: vi.fn(),
      },
      proposals: {
        addProposal: vi.fn(),
      },
      agentId: 'agent_1',
      events: {
        addEvent: vi.fn(() => {
          throw new Error('event insert failed')
        }),
      },
    })).resolves.toBeUndefined()
  })
})
