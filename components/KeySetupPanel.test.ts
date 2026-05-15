import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import KeySetupPanel from './KeySetupPanel.vue'

describe('KeySetupPanel', () => {
  it('emits configured after saving profile', async () => {
    const saveProfile = vi.fn(async () => ({
      keyId: 'key_1',
      assistantName: '星信',
      mbti: 'INTJ',
      configured: true,
    }))
    const wrapper = mount(KeySetupPanel, {
      props: { saveProfile },
    })

    await wrapper.get('input[name="assistantName"]').setValue('星信')
    await wrapper.get('select[name="mbti"]').setValue('INTJ')
    await wrapper.get('form').trigger('submit.prevent')

    expect(saveProfile).toHaveBeenCalledWith({
      assistantName: '星信',
      mbti: 'INTJ',
    })
    expect(wrapper.emitted('configured')).toBeTruthy()
  })
})
