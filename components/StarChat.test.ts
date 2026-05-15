import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StarChat from './StarChat.vue'

describe('StarChat', () => {
  it('sends user message and renders reply', async () => {
    const wrapper = mount(StarChat, {
      props: {
        sendMessage: async () => ({ reply: '这封信是真的。' }),
      },
    })

    await wrapper.find('textarea').setValue('这封信是真的吗？')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('这封信是真的')
  })
})
