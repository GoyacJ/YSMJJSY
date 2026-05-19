import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import StarPlanetPanel from './StarPlanetPanel.vue'
import type { AgentCore } from '../composables/useAgentCore'

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

const core: AgentCore = {
  profile: {
    keyId: 'key_1',
    assistantName: '阿月',
    mbti: 'INTJ',
    configured: true,
    tone: '克制',
    relationshipRole: '星球守护者',
    learningMode: '辅助学习',
    contentStrategy: {},
  },
  memoryCounts: {
    total: 1,
    active: 1,
    archived: 0,
    rejected: 0,
  },
  memories: [],
  latestReflections: [],
  proposals: {
    pending: [],
    history: [],
  },
}

describe('StarPlanetPanel', () => {
  const global = {
    stubs: {
      MemoryPlanetPanel: {
        props: ['core', 'open', 'embedded', 'initialView', 'works', 'memoryOnly'],
        template: '<section class="memory-stub" :data-embedded="String(embedded)" :data-view="initialView" :data-memory-only="String(memoryOnly)">{{ works?.[0]?.title || core?.profile?.assistantName }}</section>',
      },
      StarWorksPanel: {
        props: ['works', 'updateWorkVisibility'],
        template: '<section class="works-stub">{{ works?.[0]?.title }}</section>',
      },
      StarRecordsPanel: {
        props: ['os', 'loadOs', 'approveInboxItem'],
        template: '<section class="records-stub" :data-load-os="String(Boolean(loadOs))">{{ os?.records?.[0]?.title || "记录" }}</section>',
      },
      ProfileSettingsSheet: {
        props: ['open', 'hideTrigger'],
        template: '<section class="settings-stub" :data-open="String(open)" :data-hide-trigger="String(hideTrigger)">边界</section>',
      },
    },
  }

  it('opens one user-facing star entry with four tabs', async () => {
    const wrapper = mount(StarPlanetPanel, {
      props: {
        core,
        loadCore: vi.fn(async () => core),
      },
      global,
    })

    expect(wrapper.findAll('button.star-planet-panel__trigger')).toHaveLength(1)
    expect(wrapper.get('button.star-planet-panel__trigger').text()).toBe('星球')

    await wrapper.get('button.star-planet-panel__trigger').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('星球')
    expect(wrapper.text()).toContain('记忆')
    expect(wrapper.text()).toContain('作品')
    expect(wrapper.text()).toContain('边界')
    expect(wrapper.text()).toContain('记录')
  })

  it('mounts memory and direct works through the shell', async () => {
    const loadWorks = vi.fn(async () => [])
    const wrapper = mount(StarPlanetPanel, {
      props: {
        core,
        loadCore: vi.fn(async () => core),
        loadWorks,
        works: [{ id: 'w1', type: 'image', title: '月光图', summary: '一张图。', visibility: 'private', createdAt: '2026-05-19T00:00:00.000Z' }],
      },
      global,
    })

    await wrapper.get('button.star-planet-panel__trigger').trigger('click')
    await flushPromises()

    expect(wrapper.get('.memory-stub').attributes('data-embedded')).toBe('')
    expect(wrapper.get('.memory-stub').attributes('data-view')).toBe('planet')
    expect(wrapper.get('.memory-stub').attributes('data-memory-only')).toBe('')

    await wrapper.get('button[aria-label="查看作品"]').trigger('click')
    await flushPromises()

    expect(loadWorks).toHaveBeenCalled()
    expect(wrapper.find('.memory-stub').exists()).toBe(false)
    expect(wrapper.find('.works-stub').exists()).toBe(true)
    expect(wrapper.text()).toContain('月光图')
  })

  it('mounts boundary settings and records through the shell', async () => {
    const loadOs = vi.fn(async () => ({
      agent: {
        id: 'agent_1',
        status: 'active',
        ownerType: 'key',
        ownerId: 'key_1',
        domain: 'star',
      },
      inbox: [],
      tasks: [],
      events: [],
      records: [{ id: 'record_1', type: '失败', title: '模型调用失败', summary: '失败。', status: '失败', createdAt: '2026-05-19T00:00:00.000Z' }],
    }))
    const wrapper = mount(StarPlanetPanel, {
      props: {
        core,
        loadCore: vi.fn(async () => core),
        loadOs,
      },
      global,
    })

    await wrapper.get('button.star-planet-panel__trigger').trigger('click')
    await flushPromises()

    await wrapper.get('button[aria-label="查看边界"]').trigger('click')
    expect(wrapper.get('.settings-stub').attributes('data-open')).toBe('true')
    expect(wrapper.get('.settings-stub').attributes('data-hide-trigger')).toBe('')

    await wrapper.get('button[aria-label="查看记录"]').trigger('click')
    await flushPromises()

    expect(loadOs).toHaveBeenCalled()
    expect(wrapper.get('.records-stub').attributes('data-load-os')).toBe('true')
    expect(wrapper.text()).toContain('模型调用失败')
  })
})
