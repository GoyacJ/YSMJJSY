import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
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
        },
        template: '<section class="agent-core-stub" :data-embedded="String(embedded)">星AI</section>',
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
