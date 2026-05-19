import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProfileSettingsSheet from './ProfileSettingsSheet.vue'

const boundarySettings = {
  memoryWriteMode: 'assisted',
  generatedWorksDefaultVisibility: 'private',
  requireApprovalForPublishing: true,
  requireApprovalForPersonaChange: true,
  requireApprovalForSensitiveMemory: true,
  disallowedMemoryTopics: ['身份证号'],
  allowedMemoryTopics: ['写作偏好'],
  minorMode: false,
} as const

describe('ProfileSettingsSheet', () => {
  const global = {
    stubs: {
      MiniMaxQuotaPanel: {
        template: '<section class="quota-panel">星能量</section>',
      },
    },
  }

  it('opens settings with current assistant profile', async () => {
    const loadProfile = vi.fn(async () => ({
      keyId: 'key_1',
      assistantName: '月光',
      mbti: 'INFJ',
      configured: true,
      boundarySettings,
    }))

    const wrapper = mount(ProfileSettingsSheet, {
      props: { loadProfile },
      global,
    })

    expect(wrapper.get('button[aria-label="打开设置"]').exists()).toBe(true)

    await wrapper.get('button[aria-label="打开设置"]').trigger('click')
    await flushPromises()

    expect(loadProfile).toHaveBeenCalled()
    expect(wrapper.text()).toContain('星能量')
    expect(wrapper.find('.agent-core-stub').exists()).toBe(false)
    const closeButton = wrapper.get('button[aria-label="关闭设置"]')

    expect(closeButton.text()).toBe('×')
    expect(closeButton.classes()).toContain('dialog-close-button')
    expect((wrapper.get('input[name="assistantName"]').element as HTMLInputElement).value).toBe('月光')
    expect((wrapper.get('select[name="mbti"]').element as HTMLSelectElement).value).toBe('INFJ')
    expect(wrapper.find('option[value="public"]').exists()).toBe(false)
  })

  it('saves profile updates', async () => {
    const loadProfile = vi.fn(async () => ({
      keyId: 'key_1',
      assistantName: '月光',
      mbti: 'INFJ',
      configured: true,
      boundarySettings,
    }))
    const saveProfile = vi.fn(async () => ({
      keyId: 'key_1',
      assistantName: '星信',
      mbti: 'INTJ',
      configured: true,
      boundarySettings: {
        ...boundarySettings,
        memoryWriteMode: 'manual',
        disallowedMemoryTopics: ['身份证号', '银行卡'],
        minorMode: true,
      },
    }))

    const wrapper = mount(ProfileSettingsSheet, {
      props: { loadProfile, saveProfile },
      global,
    })

    await wrapper.get('button[aria-label="打开设置"]').trigger('click')
    await flushPromises()
    await wrapper.get('input[name="assistantName"]').setValue('星信')
    await wrapper.get('select[name="mbti"]').setValue('INTJ')
    await wrapper.get('select[name="memoryWriteMode"]').setValue('manual')
    await wrapper.get('textarea[name="disallowedMemoryTopics"]').setValue('身份证号\n银行卡')
    await wrapper.get('input[name="minorMode"]').setValue(true)
    await wrapper.get('form').trigger('submit.prevent')

    expect(saveProfile).toHaveBeenCalledWith({
      assistantName: '星信',
      mbti: 'INTJ',
      boundarySettings: {
        ...boundarySettings,
        memoryWriteMode: 'manual',
        disallowedMemoryTopics: ['身份证号', '银行卡'],
        minorMode: true,
      },
    })
    expect(wrapper.emitted('updated')?.[0]?.[0]).toMatchObject({
      assistantName: '星信',
      mbti: 'INTJ',
    })
  })

  it('does not render agent core inside settings', async () => {
    const loadProfile = vi.fn(async () => ({
      keyId: 'key_1',
      assistantName: '月光',
      mbti: 'INFJ',
      configured: true,
      boundarySettings,
    }))

    const wrapper = mount(ProfileSettingsSheet, {
      props: {
        loadProfile,
      },
      global,
    })

    await wrapper.get('button[aria-label="打开设置"]').trigger('click')
    await flushPromises()

    expect(wrapper.findComponent({ name: 'AgentCorePanel' }).exists()).toBe(false)
  })

  it('loads boundary fields into the settings form', async () => {
    const loadProfile = vi.fn(async () => ({
      keyId: 'key_1',
      assistantName: '月光',
      mbti: 'INFJ',
      configured: true,
      boundarySettings: {
        ...boundarySettings,
        memoryWriteMode: 'manual',
        disallowedMemoryTopics: ['身份证号', '银行卡'],
        minorMode: true,
      },
    }))

    const wrapper = mount(ProfileSettingsSheet, {
      props: { loadProfile },
      global,
    })

    await wrapper.get('button[aria-label="打开设置"]').trigger('click')
    await flushPromises()

    expect((wrapper.get('select[name="memoryWriteMode"]').element as HTMLSelectElement).value).toBe('manual')
    expect((wrapper.get('textarea[name="disallowedMemoryTopics"]').element as HTMLTextAreaElement).value).toBe('身份证号\n银行卡')
    expect((wrapper.get('input[name="minorMode"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('renders data export and destructive actions behind confirmation input', async () => {
    const loadProfile = vi.fn(async () => ({
      keyId: 'key_1',
      assistantName: '月光',
      mbti: 'INFJ',
      configured: true,
      boundarySettings,
    }))

    const wrapper = mount(ProfileSettingsSheet, {
      props: { loadProfile },
      global,
    })

    await wrapper.get('button[aria-label="打开设置"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('button[aria-label="导出聊天记录"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="导出记忆"]').exists()).toBe(true)
    expect(wrapper.get('input[name="deleteConfirmation"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="删除聊天记录"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[aria-label="清空记忆"]').attributes('disabled')).toBeDefined()

    await wrapper.get('input[name="deleteConfirmation"]').setValue('DELETE')

    expect(wrapper.get('button[aria-label="删除聊天记录"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('button[aria-label="清空记忆"]').attributes('disabled')).toBeUndefined()
  })
})
