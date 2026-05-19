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
      boundarySettings: {
        memoryWriteMode: 'assisted',
        generatedWorksDefaultVisibility: 'private',
        requireApprovalForPublishing: true,
        requireApprovalForPersonaChange: true,
        requireApprovalForSensitiveMemory: true,
        disallowedMemoryTopics: ['身份证号', '银行卡'],
        allowedMemoryTopics: ['写作偏好'],
        minorMode: true,
      },
    }))
    const wrapper = mount(KeySetupPanel, {
      props: { saveProfile },
    })

    await wrapper.get('input[name="assistantName"]').setValue('星信')
    await wrapper.get('select[name="mbti"]').setValue('INTJ')
    await wrapper.get('textarea[name="disallowedMemoryTopics"]').setValue('身份证号\n银行卡')
    await wrapper.get('textarea[name="allowedMemoryTopics"]').setValue('写作偏好')
    await wrapper.get('input[name="minorMode"]').setValue(true)

    expect(wrapper.find('option[value="public"]').exists()).toBe(false)

    await wrapper.get('form').trigger('submit.prevent')

    expect(saveProfile).toHaveBeenCalledWith({
      assistantName: '星信',
      mbti: 'INTJ',
      boundarySettings: {
        memoryWriteMode: 'assisted',
        generatedWorksDefaultVisibility: 'private',
        requireApprovalForPublishing: true,
        requireApprovalForPersonaChange: true,
        requireApprovalForSensitiveMemory: true,
        disallowedMemoryTopics: ['身份证号', '银行卡'],
        allowedMemoryTopics: ['写作偏好'],
        minorMode: true,
      },
    })
    expect(wrapper.emitted('configured')).toBeTruthy()
  })
})
