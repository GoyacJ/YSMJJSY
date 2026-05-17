import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MemoryPlanetPanel from './MemoryPlanetPanel.vue'
import type { AgentCore } from '../composables/useAgentCore'

const core: AgentCore = {
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
    total: 1,
    active: 1,
    archived: 0,
    rejected: 0,
  },
  memories: [
    {
      id: 'm1',
      type: 'preference',
      content: '用户喜欢短句。',
      importance: 0.9,
      confidence: 0.92,
      status: 'active',
      sourceConversationId: 'c1',
      sourceAttachmentId: 'a1',
      sourceExcerpt: '用户说自己喜欢短句。',
      governanceEvents: [
        {
          id: 'event_1',
          action: 'confirm',
          reason: '用户明确表达。',
          createdAt: '2026-05-17T00:02:00.000Z',
        },
      ],
      createdAt: '2026-05-17T00:00:00.000Z',
    },
  ],
  latestReflections: [
    {
      id: 'r1',
      summary: '用户偏好克制表达。',
      createdAt: '2026-05-17T00:01:00.000Z',
    },
  ],
  proposals: {
    pending: [
      {
        id: 'p1',
        type: 'tone',
        title: '更安静',
        summary: '回复更安静。',
        payload: { tone: '安静' },
        status: 'pending',
        createdAt: '2026-05-17T00:02:00.000Z',
        updatedAt: '2026-05-17T00:02:00.000Z',
      },
    ],
    history: [
      {
        id: 'p2',
        type: 'relationship_role',
        title: '守护者',
        summary: '成为守护者。',
        payload: { relationshipRole: '守护者' },
        status: 'accepted',
        createdAt: '2026-05-17T00:03:00.000Z',
        updatedAt: '2026-05-17T00:03:00.000Z',
      },
      {
        id: 'p3',
        type: 'content_strategy',
        title: '少解释',
        summary: '减少解释。',
        payload: { strategy: 'brief' },
        status: 'applied',
        createdAt: '2026-05-17T00:04:00.000Z',
        updatedAt: '2026-05-17T00:04:00.000Z',
      },
    ],
  },
}

describe('MemoryPlanetPanel', () => {
  const global = {
    stubs: {
      AgentCorePanel: {
        props: {
          embedded: Boolean,
          loadCore: Function,
          applyProposal: Function,
          runSleep: Function,
        },
        template: '<section class="agent-core-stub" :data-embedded="String(embedded)" :data-load-core="String(Boolean(loadCore))" :data-apply-proposal="String(Boolean(applyProposal))" :data-run-sleep="String(Boolean(runSleep))">星AI</section>',
      },
    },
  }

  it('renders an empty state', () => {
    const wrapper = mount(MemoryPlanetPanel, {
      props: {
        core: null,
        open: true,
      },
      global,
    })

    expect(wrapper.text()).toContain('记忆星球')
    expect(wrapper.text()).toContain('还没有形成星球')
  })

  it('closes when the backdrop is clicked', async () => {
    const wrapper = mount(MemoryPlanetPanel, {
      props: {
        core,
        open: true,
      },
      global,
    })

    await wrapper.get('.memory-planet-panel__backdrop').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('shows an explicit close button', () => {
    const wrapper = mount(MemoryPlanetPanel, {
      props: {
        core,
        open: true,
      },
      global,
    })

    const button = wrapper.get('button[aria-label="关闭记忆星球"]')

    expect(button.text()).toBe('关闭')
  })

  it('renders memory stars and opens memory detail', async () => {
    const wrapper = mount(MemoryPlanetPanel, {
      props: {
        core,
        open: true,
      },
      global,
    })

    await wrapper.get('button[aria-label="查看记忆：用户喜欢短句。"]').trigger('click')

    expect(wrapper.text()).toContain('用户喜欢短句。')
    expect(wrapper.text()).toContain('preference')
  })

  it('shows memory governance actions for a selected memory', async () => {
    const governMemory = vi.fn(async () => true)
    const wrapper = mount(MemoryPlanetPanel, {
      props: { core, open: true, governMemory },
      global,
    })

    await wrapper.get('button[aria-label="查看记忆：用户喜欢短句。"]').trigger('click')

    expect(wrapper.text()).toContain('重要性')
    expect(wrapper.get('button[aria-label="归档记忆"]').exists()).toBe(true)

    await wrapper.get('button[aria-label="归档记忆"]').trigger('click')
    expect(governMemory).toHaveBeenCalledWith('m1', 'archive')
  })

  it('shows source and governance history for a selected memory', async () => {
    const wrapper = mount(MemoryPlanetPanel, {
      props: { core, open: true },
      global,
    })

    await wrapper.get('button[aria-label="查看记忆：用户喜欢短句。"]').trigger('click')

    expect(wrapper.text()).toContain('来源')
    expect(wrapper.text()).toContain('c1')
    expect(wrapper.text()).toContain('用户说自己喜欢短句。')
    expect(wrapper.text()).toContain('状态 active')
    expect(wrapper.text()).toContain('最近治理动作')
    expect(wrapper.text()).toContain('confirm')
  })

  it('switches between planet, timeline, and works views', async () => {
    const wrapper = mount(MemoryPlanetPanel, {
      props: {
        core,
        open: true,
        timeline: [{ id: 't1', type: 'memory', title: '形成记忆', summary: '用户喜欢短句。', createdAt: '2026-05-17T00:00:00.000Z' }],
        works: [{ id: 'w1', type: 'image', title: '月光图', summary: '一张图。', visibility: 'private', createdAt: '2026-05-17T00:00:00.000Z' }],
      },
      global,
    })

    await wrapper.get('button[aria-label="查看星球时间线"]').trigger('click')
    expect(wrapper.text()).toContain('形成记忆')

    await wrapper.get('button[aria-label="查看智能体作品"]').trigger('click')
    expect(wrapper.text()).toContain('月光图')
  })

  it('renders reflections, pending proposals, and accepted evolution rings', () => {
    const wrapper = mount(MemoryPlanetPanel, {
      props: {
        core,
        open: true,
      },
      global,
    })

    expect(wrapper.findAll('.memory-planet-stage__nebula')).toHaveLength(1)
    expect(wrapper.get('button[aria-label="查看进化提案：更安静"]').exists()).toBe(true)
    expect(wrapper.findAll('.memory-planet-stage__orbit-ring')).toHaveLength(2)
  })

  it('renders agent core inside the planet panel', () => {
    const wrapper = mount(MemoryPlanetPanel, {
      props: {
        core,
        open: true,
      },
      global,
    })

    expect(wrapper.get('.agent-core-stub').attributes('data-embedded')).toBe('true')
    expect(wrapper.text()).toContain('星AI')
    expect(wrapper.text()).not.toContain('智能体核心')
  })

  it('passes shared agent core actions to the embedded star ai', () => {
    const loadCore = vi.fn(async () => core)
    const applyProposal = vi.fn(async () => true)
    const runSleep = vi.fn(async () => true)
    const wrapper = mount(MemoryPlanetPanel, {
      props: {
        core,
        open: true,
        loadCore,
        applyProposal,
        runSleep,
      },
      global,
    })

    const panel = wrapper.get('.agent-core-stub')

    expect(panel.attributes('data-load-core')).toBe('true')
    expect(panel.attributes('data-apply-proposal')).toBe('true')
    expect(panel.attributes('data-run-sleep')).toBe('true')
  })

  it('places the planet stage and star ai in the same designed layout', () => {
    const wrapper = mount(MemoryPlanetPanel, {
      props: {
        core,
        open: true,
      },
      global,
    })

    expect(wrapper.get('.memory-planet-panel__layout').exists()).toBe(true)
    expect(wrapper.get('.memory-planet-panel__layout .memory-planet-stage').exists()).toBe(true)
    expect(wrapper.get('.memory-planet-panel__ai .agent-core-stub').attributes('data-embedded')).toBe('true')
  })

  it('lets the embedded star ai area expand with the planet panel', () => {
    const css = readFileSync(resolve(process.cwd(), 'assets/css/main.css'), 'utf8')

    expect(css).toContain('min-height: min(25rem, calc(100dvh - 15rem));')
    expect(css).toContain('.memory-planet-panel__ai .agent-core-panel')
    expect(css).toContain('.memory-planet-panel__ai .agent-core-panel__sheet')
  })
})
