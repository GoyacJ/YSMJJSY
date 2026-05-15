import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProfileSettingsSheet from './ProfileSettingsSheet.vue'

describe('ProfileSettingsSheet', () => {
  it('opens settings with current assistant profile', async () => {
    const loadProfile = vi.fn(async () => ({
      keyId: 'key_1',
      assistantName: '月光',
      mbti: 'INFJ',
      configured: true,
    }))

    const wrapper = mount(ProfileSettingsSheet, {
      props: { loadProfile },
    })

    expect(wrapper.get('button[aria-label="打开设置"]').exists()).toBe(true)

    await wrapper.get('button[aria-label="打开设置"]').trigger('click')
    await flushPromises()

    expect(loadProfile).toHaveBeenCalled()
    expect((wrapper.get('input[name="assistantName"]').element as HTMLInputElement).value).toBe('月光')
    expect((wrapper.get('select[name="mbti"]').element as HTMLSelectElement).value).toBe('INFJ')
  })

  it('saves profile updates', async () => {
    const loadProfile = vi.fn(async () => ({
      keyId: 'key_1',
      assistantName: '月光',
      mbti: 'INFJ',
      configured: true,
    }))
    const saveProfile = vi.fn(async () => ({
      keyId: 'key_1',
      assistantName: '星信',
      mbti: 'INTJ',
      configured: true,
    }))

    const wrapper = mount(ProfileSettingsSheet, {
      props: { loadProfile, saveProfile },
    })

    await wrapper.get('button[aria-label="打开设置"]').trigger('click')
    await flushPromises()
    await wrapper.get('input[name="assistantName"]').setValue('星信')
    await wrapper.get('select[name="mbti"]').setValue('INTJ')
    await wrapper.get('form').trigger('submit.prevent')

    expect(saveProfile).toHaveBeenCalledWith({
      assistantName: '星信',
      mbti: 'INTJ',
    })
    expect(wrapper.emitted('updated')?.[0]?.[0]).toMatchObject({
      assistantName: '星信',
      mbti: 'INTJ',
    })
  })
})
