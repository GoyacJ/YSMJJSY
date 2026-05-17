import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
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
}

describe('AgentCorePanel', () => {
  it('renders profile, memory counts, reflections, and pending proposals', async () => {
    const wrapper = mount(AgentCorePanel, {
      props: {
        loadCore: async () => core,
        applyProposal: vi.fn(),
      },
    })

    expect(wrapper.get('button[aria-label="打开星AI"]').text()).toBe('星AI')

    await wrapper.get('button[aria-label="打开星AI"]').trigger('click')
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
  })

  it('accept button calls proposal update', async () => {
    const applyProposal = vi.fn(async () => true)
    const wrapper = mount(AgentCorePanel, {
      props: {
        loadCore: async () => core,
        applyProposal,
      },
    })

    await wrapper.get('button[aria-label="打开星AI"]').trigger('click')
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

    await wrapper.get('button[aria-label="打开星AI"]').trigger('click')
    await flushPromises()
    await wrapper.get('button[aria-label="拒绝提案"]').trigger('click')

    expect(applyProposal).toHaveBeenCalledWith('p1', 'reject')
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
        }),
        applyProposal: vi.fn(),
      },
    })

    await wrapper.get('button[aria-label="打开星AI"]').trigger('click')
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

    expect(wrapper.find('button[aria-label="打开星AI"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('星AI')
    expect(wrapper.text()).not.toContain('智能体核心')
    expect(wrapper.text()).toContain('回复更短。')
  })
})
