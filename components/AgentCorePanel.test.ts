import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { useAgentOs } from '../composables/useAgentOs'
import AgentCorePanel from './AgentCorePanel.vue'

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

const core = {
  profile: {
    keyId: 'key_1',
    assistantName: '阿月',
    mbti: 'INTJ',
    configured: true,
    tone: '克制、温柔、安静',
    relationshipRole: '记忆星球守护者',
    learningMode: '辅助学习',
    contentStrategy: {},
  },
  memoryCounts: {
    total: 3,
    active: 2,
    archived: 1,
    rejected: 0,
  },
  latestReflections: [
    {
      id: 'r1',
      summary: '用户喜欢短句。',
      createdAt: '2026-05-17T00:00:00.000Z',
    },
  ],
  memories: [],
  proposals: {
    pending: [
      {
        id: 'p1',
        type: 'tone',
        title: '更短',
        summary: '回复更短。',
        payload: { tone: '更短' },
        status: 'pending',
        createdAt: '2026-05-17T00:00:00.000Z',
        updatedAt: '2026-05-17T00:00:00.000Z',
      },
    ],
    history: [
      {
        id: 'p2',
        type: 'relationship_role',
        title: '守护者',
        summary: '关系定位为守护者。',
        payload: { relationshipRole: '守护者' },
        status: 'accepted',
        createdAt: '2026-05-17T00:01:00.000Z',
        updatedAt: '2026-05-17T00:02:00.000Z',
      },
    ],
  },
  snapshots: [],
  sleep: {
    lastSleepAt: null,
    nextSleepAt: '2026-05-17T12:00:00.000Z',
    latestRun: null,
  },
}

describe('AgentCorePanel', () => {
  it('exposes agent os composable actions for panel integration', () => {
    const agentOs = useAgentOs()

    expect(agentOs.os.value).toBeNull()
    expect(agentOs.loadOs).toEqual(expect.any(Function))
    expect(agentOs.approveInboxItem).toEqual(expect.any(Function))
    expect(agentOs.rejectInboxItem).toEqual(expect.any(Function))
  })

  it('renders profile, memory counts, reflections, and pending proposals', async () => {
    const wrapper = mount(AgentCorePanel, {
      props: {
        loadCore: async () => core,
        applyProposal: vi.fn(),
      },
    })

    expect(wrapper.get('button.agent-core-panel__trigger').text()).toBe('打开星AI')

    await wrapper.get('button.agent-core-panel__trigger').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('星AI')
    expect(wrapper.text()).not.toContain('智能体核心')
    expect(wrapper.text()).toContain('阿月')
    expect(wrapper.text()).toContain('INTJ')
    expect(wrapper.text()).toContain('记忆 2/3')
    expect(wrapper.text()).toContain('当前状态')
    expect(wrapper.text()).toContain('克制、温柔、安静')
    expect(wrapper.text()).toContain('记忆星球守护者')
    expect(wrapper.text()).toContain('辅助学习')
    expect(wrapper.text()).toContain('最近反思')
    expect(wrapper.text()).toContain('用户喜欢短句。')
    expect(wrapper.text()).toContain('待确认进化')
    expect(wrapper.text()).toContain('回复更短。')
    expect(wrapper.text()).toContain('接受后：语气会调整为更短')
    expect(wrapper.text()).toContain('进化历史')
    expect(wrapper.text()).toContain('关系定位为守护者。')

    const closeButton = wrapper.get('button[aria-label="关闭面板"]')

    expect(closeButton.text()).toBe('×')
    expect(closeButton.classes()).toContain('dialog-close-button')
  })

  it('shows agent os inbox and task center when os state is provided', async () => {
    const approveInboxItem = vi.fn(async () => true)
    const wrapper = mount(AgentCorePanel, {
      props: {
        loadCore: async () => core,
        loadOs: async () => ({
          agent: { id: 'agent_1', status: 'active', ownerType: 'key', ownerId: 'key_1', domain: 'star' },
          inbox: [
            {
              id: 'proposal:p1',
              type: 'proposal',
              title: '更短',
              summary: '回复更短。',
              action: 'approve',
              createdAt: '2026-05-18T00:00:00.000Z',
            },
          ],
          tasks: [
            {
              id: 'task_1',
              type: 'sleep',
              status: 'completed',
              title: '睡眠整理',
              summary: '整理完成。',
              createdAt: '2026-05-18T00:00:00.000Z',
              updatedAt: '2026-05-18T00:01:00.000Z',
            },
          ],
          events: [],
        }),
        approveInboxItem,
        applyProposal: vi.fn(),
      },
    })

    await wrapper.get('button.agent-core-panel__trigger').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('决策收件箱')
    expect(wrapper.text()).toContain('任务中心')
    expect(wrapper.text()).toContain('睡眠整理')

    const approveButton = wrapper.findAll('button').find(button => button.text() === '批准')
    expect(approveButton).toBeTruthy()
    await approveButton!.trigger('click')
    expect(approveInboxItem).toHaveBeenCalledWith('proposal:p1')
  })

  it('shows agent events without raw payloads', async () => {
    const wrapper = mount(AgentCorePanel, {
      props: {
        loadCore: async () => core,
        loadOs: async () => ({
          agent: { id: 'agent_1', status: 'active', ownerType: 'key', ownerId: 'key_1', domain: 'star' },
          inbox: [
            {
              id: 'memory_governance:m1:archive',
              type: 'memory_governance',
              title: '记忆治理',
              summary: '过期。',
              action: 'execute',
              createdAt: '2026-05-18T00:00:00.000Z',
            },
            {
              id: 'task_approval:task_1',
              type: 'task_approval',
              title: '公开作品',
              summary: '公开月光图。',
              action: 'approve',
              createdAt: '2026-05-18T00:00:00.000Z',
            },
          ],
          tasks: [
            {
              id: 'task_1',
              type: 'publish_artifact',
              status: 'waiting_approval',
              title: '公开作品',
              summary: '公开月光图。',
              createdAt: '2026-05-18T00:00:00.000Z',
              updatedAt: '2026-05-18T00:00:00.000Z',
            },
          ],
          events: [{
            id: 'event_1',
            type: 'provider.failed',
            title: 'Provider failed',
            summary: '模型失败。',
            createdAt: '2026-05-18T00:00:00.000Z',
          }],
        }),
        applyProposal: vi.fn(),
      },
    })

    await wrapper.get('button.agent-core-panel__trigger').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('审计事件')
    expect(wrapper.text()).toContain('Provider failed')
    expect(wrapper.text()).toContain('记忆治理')
    expect(wrapper.text()).toContain('执行')
    expect(wrapper.text()).toContain('公开作品')
    expect(wrapper.text()).not.toContain('payloadJson')
  })

  it('can run and cancel os tasks', async () => {
    const runTask = vi.fn(async () => true)
    const cancelTask = vi.fn(async () => true)
    const wrapper = mount(AgentCorePanel, {
      props: {
        loadCore: async () => core,
        loadOs: async () => ({
          agent: { id: 'agent_1', status: 'active', ownerType: 'key', ownerId: 'key_1', domain: 'star' },
          inbox: [],
          tasks: [
            {
              id: 'task_1',
              type: 'generate_artifact',
              status: 'queued',
              title: '生成图片',
              summary: '生成图片。',
              createdAt: '2026-05-18T00:00:00.000Z',
              updatedAt: '2026-05-18T00:00:00.000Z',
            },
          ],
          events: [],
        }),
        runTask,
        cancelTask,
        applyProposal: vi.fn(),
      },
    })

    await wrapper.get('button.agent-core-panel__trigger').trigger('click')
    await flushPromises()
    const runButton = wrapper.findAll('button').find(button => button.text() === '运行')
    expect(runButton).toBeTruthy()
    await runButton!.trigger('click')
    await flushPromises()
    const cancelButton = wrapper.findAll('button').find(button => button.text() === '取消')
    expect(cancelButton).toBeTruthy()
    await cancelButton!.trigger('click')

    expect(runTask).toHaveBeenCalledWith('task_1')
    expect(cancelTask).toHaveBeenCalledWith('task_1')
  })

  it('creates an image task from the task center', async () => {
    const enqueueTask = vi.fn(async () => ({ id: 'task_1' }))
    const wrapper = mount(AgentCorePanel, {
      props: {
        embedded: true,
        loadCore: async () => core,
        loadOs: async () => ({
          agent: { id: 'agent_1', status: 'active', ownerType: 'key', ownerId: 'key_1', domain: 'star' },
          inbox: [],
          tasks: [],
          events: [],
        }),
        enqueueTask,
      },
    })

    await flushPromises()
    await wrapper.get('[aria-label="任务提示词"]').setValue('月光森林')
    await wrapper.get('[aria-label="创建图片任务"]').trigger('click')

    expect(enqueueTask).toHaveBeenCalledWith({
      type: 'generate_artifact',
      input: { artifactType: 'image', prompt: '月光森林' },
    })
  })

  it('creates a task from an observation-based plan', async () => {
    const enqueueTask = vi.fn(async () => ({ id: 'task_1' }))
    const wrapper = mount(AgentCorePanel, {
      props: {
        embedded: true,
        loadCore: async () => core,
        loadOs: async () => ({
          agent: { id: 'agent_1', status: 'active', ownerType: 'key', ownerId: 'key_1', domain: 'star' },
          inbox: [],
          tasks: [],
          events: [],
          plannedTasks: [
            {
              type: 'sleep',
              title: '睡眠整理',
              summary: '根据最近观察整理记忆和提案。',
              input: { toolName: 'star.sleep', input: {} },
            },
          ],
        }),
        enqueueTask,
      },
    })

    await flushPromises()
    await wrapper.get('[aria-label="创建计划任务"]').trigger('click')

    expect(enqueueTask).toHaveBeenCalledWith({
      type: 'sleep',
      input: { toolName: 'star.sleep', input: {} },
    })
  })

  it('accept button calls proposal update', async () => {
    const applyProposal = vi.fn(async () => true)
    const wrapper = mount(AgentCorePanel, {
      props: {
        loadCore: async () => core,
        applyProposal,
      },
    })

    await wrapper.get('button.agent-core-panel__trigger').trigger('click')
    await flushPromises()
    await wrapper.get('button[aria-label="接受提案"]').trigger('click')

    expect(applyProposal).toHaveBeenCalledWith('p1', 'accept')
  })

  it('reject button calls proposal update', async () => {
    const applyProposal = vi.fn(async () => true)
    const wrapper = mount(AgentCorePanel, {
      props: {
        loadCore: async () => core,
        applyProposal,
      },
    })

    await wrapper.get('button.agent-core-panel__trigger').trigger('click')
    await flushPromises()
    await wrapper.get('button[aria-label="拒绝提案"]').trigger('click')

    expect(applyProposal).toHaveBeenCalledWith('p1', 'reject')
  })

  it('uses preview action for page design proposals', async () => {
    const previewDesignProposal = vi.fn(async () => true)
    const applyProposal = vi.fn(async () => true)
    const wrapper = mount(AgentCorePanel, {
      props: {
        loadCore: async () => ({
          ...core,
          proposals: {
            pending: [
              {
                id: 'p_design',
                type: 'page_design',
                title: '调整页面',
                summary: '让页面更像星空。',
                payload: { instruction: '更像星空' },
                status: 'pending',
                createdAt: '2026-05-18T00:00:00.000Z',
                updatedAt: '2026-05-18T00:00:00.000Z',
              },
            ],
            history: [],
          },
        }),
        applyProposal,
        previewDesignProposal,
      },
    })

    await wrapper.get('button.agent-core-panel__trigger').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('生成预览')
    expect(wrapper.find('button[aria-label="接受提案"]').exists()).toBe(false)

    await wrapper.get('button[aria-label="生成设计预览"]').trigger('click')

    expect(previewDesignProposal).toHaveBeenCalledWith('p_design')
    expect(applyProposal).not.toHaveBeenCalled()
  })

  it('renders empty state without crashing', async () => {
    const wrapper = mount(AgentCorePanel, {
      props: {
        loadCore: async () => ({
          profile: {
            keyId: 'key_1',
            assistantName: '阿月',
            mbti: 'INTJ',
            configured: true,
            tone: '克制、温柔、安静',
            relationshipRole: '记忆星球守护者',
            learningMode: '辅助学习',
            contentStrategy: {},
          },
          memoryCounts: {
            total: 0,
            active: 0,
            archived: 0,
            rejected: 0,
          },
          memories: [],
          latestReflections: [],
          proposals: {
            pending: [],
            history: [],
          },
          sleep: {
            lastSleepAt: null,
            nextSleepAt: null,
            latestRun: null,
          },
        }),
        applyProposal: vi.fn(),
      },
    })

    await wrapper.get('button.agent-core-panel__trigger').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('还没有反思')
    expect(wrapper.text()).toContain('没有待确认提案')
    expect(wrapper.text()).toContain('还没有进化历史')
  })

  it('renders embedded without a floating trigger', async () => {
    const wrapper = mount(AgentCorePanel, {
      props: {
        embedded: true,
        loadCore: async () => core,
        applyProposal: vi.fn(),
      },
    })

    await flushPromises()

    expect(wrapper.find('button.agent-core-panel__trigger').exists()).toBe(false)
    expect(wrapper.text()).toContain('星AI')
    expect(wrapper.text()).not.toContain('智能体核心')
    expect(wrapper.text()).toContain('回复更短。')
  })

  it('shows sleep status and can trigger a sleep run', async () => {
    const loadCore = vi.fn(async () => ({
      ...core,
      sleep: {
        lastSleepAt: null,
        nextSleepAt: '2026-05-17T12:00:00.000Z',
        latestRun: null,
      },
    }))
    const runSleep = vi.fn(async () => true)
    const wrapper = mount(AgentCorePanel, {
      props: { loadCore, runSleep, applyProposal: vi.fn() },
    })

    await wrapper.get('button.agent-core-panel__trigger').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('睡眠周期')
    await wrapper.get('button[aria-label="让智能体思考"]').trigger('click')
    expect(runSleep).toHaveBeenCalled()
  })

  it('renders the full latest sleep report', async () => {
    const wrapper = mount(AgentCorePanel, {
      props: {
        loadCore: async () => ({
          ...core,
          sleep: {
            lastSleepAt: '2026-05-18T00:00:00.000Z',
            nextSleepAt: '2026-05-18T12:00:00.000Z',
            latestRun: {
              id: 'sleep_1',
              status: 'completed',
              summary: '整理完成。',
              memoryActions: [{ memoryId: 'm1', action: 'confirm', reason: '明确表达' }],
              workIdeas: [{ type: 'letter', title: '短句回信', summary: '写一封短信' }],
              nextConversationHints: ['承接短句偏好'],
              startedAt: '2026-05-18T00:00:00.000Z',
              completedAt: '2026-05-18T00:01:00.000Z',
              error: null,
            },
          },
        }),
        applyProposal: vi.fn(),
      },
    })

    await wrapper.get('button.agent-core-panel__trigger').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('整理完成。')
    expect(wrapper.text()).toContain('记忆动作 1')
    expect(wrapper.text()).toContain('短句回信')
    expect(wrapper.text()).toContain('承接短句偏好')
  })

  it('restores an applied proposal snapshot', async () => {
    const restoreSnapshot = vi.fn(async () => true)
    const wrapper = mount(AgentCorePanel, {
      props: {
        loadCore: async () => ({
          ...core,
          proposals: {
            pending: [],
            history: [
              {
                id: 'p_applied',
                type: 'tone',
                title: '更短',
                summary: '回复更短。',
                payload: { tone: '更短' },
                status: 'applied',
                createdAt: '2026-05-18T00:00:00.000Z',
                updatedAt: '2026-05-18T00:01:00.000Z',
              },
            ],
          },
          snapshots: [
            {
              id: 'snap_1',
              proposalId: 'p_applied',
              createdAt: '2026-05-18T00:00:30.000Z',
            },
          ],
        }),
        applyProposal: vi.fn(),
        restoreSnapshot,
      },
    })

    await wrapper.get('button.agent-core-panel__trigger').trigger('click')
    await flushPromises()
    await wrapper.get('button[aria-label="回滚提案"]').trigger('click')

    expect(restoreSnapshot).toHaveBeenCalledWith('snap_1')
  })
})
