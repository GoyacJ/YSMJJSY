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
  pendingProposals: [
    {
      id: 'p1',
      type: 'tone',
      title: '更短',
      summary: '回复更短。',
      payload: { tone: 'concise' },
      createdAt: '2026-05-17T00:00:00.000Z',
    },
  ],
}

describe('AgentCorePanel', () => {
  it('renders profile, memory counts, reflections, and pending proposals', async () => {
    const wrapper = mount(AgentCorePanel, {
      props: {
        loadCore: async () => core,
        applyProposal: vi.fn(),
      },
    })

    await wrapper.get('button[aria-label="打开 Agent Core"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('阿月')
    expect(wrapper.text()).toContain('INTJ')
    expect(wrapper.text()).toContain('记忆 2/3')
    expect(wrapper.text()).toContain('用户喜欢短句。')
    expect(wrapper.text()).toContain('回复更短。')
  })

  it('accept button calls proposal update', async () => {
    const applyProposal = vi.fn(async () => true)
    const wrapper = mount(AgentCorePanel, {
      props: {
        loadCore: async () => core,
        applyProposal,
      },
    })

    await wrapper.get('button[aria-label="打开 Agent Core"]').trigger('click')
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

    await wrapper.get('button[aria-label="打开 Agent Core"]').trigger('click')
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
          },
          memoryCounts: {
            total: 0,
            active: 0,
            archived: 0,
            rejected: 0,
          },
          latestReflections: [],
          pendingProposals: [],
        }),
        applyProposal: vi.fn(),
      },
    })

    await wrapper.get('button[aria-label="打开 Agent Core"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('还没有反思')
    expect(wrapper.text()).toContain('没有待确认提案')
  })
})
