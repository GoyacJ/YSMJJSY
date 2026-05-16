import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StarOrbitStage from './StarOrbitStage.vue'

describe('StarOrbitStage', () => {
  it('groups a user message with the following assistant reply', () => {
    const wrapper = mount(StarOrbitStage, {
      props: {
        messages: [
          { role: 'user', content: '今晚的星星像一封信。', parts: [{ type: 'text', text: '今晚的星星像一封信。' }] },
          { role: 'assistant', content: '我会陪你把它读完。', parts: [{ type: 'text', text: '我会陪你把它读完。' }] },
        ],
        activeMessageIndex: null,
      },
    })

    expect(wrapper.get('.star-orbit-stage').exists()).toBe(true)
    expect(wrapper.findAll('.star-orbit-group')).toHaveLength(1)
    expect(wrapper.text()).toContain('今晚的星星像一封信。')
    expect(wrapper.text()).toContain('我会陪你把它读完。')
  })

  it('marks media replies as nebula mood', () => {
    const wrapper = mount(StarOrbitStage, {
      props: {
        messages: [
          { role: 'user', content: '画一张月光', parts: [{ type: 'text', text: '画一张月光' }] },
          {
            role: 'assistant',
            content: '画好了。',
            parts: [
              { type: 'text', text: '画好了。' },
              { type: 'image', base64: 'abc' },
            ],
          },
        ],
        activeMessageIndex: null,
      },
    })

    expect(wrapper.get('.star-orbit-group').attributes('data-mood')).toBe('nebula')
    expect(wrapper.get('button[aria-label="回看记忆：图像记忆"]').exists()).toBe(true)
  })

  it('keeps a dangling user message as its own orbit group', () => {
    const wrapper = mount(StarOrbitStage, {
      props: {
        messages: [
          { role: 'user', content: '你还在吗？', parts: [{ type: 'text', text: '你还在吗？' }] },
        ],
        activeMessageIndex: null,
      },
    })

    expect(wrapper.findAll('.star-orbit-group')).toHaveLength(1)
    expect(wrapper.text()).toContain('你还在吗？')
  })

  it('opens a memory recap from a memory star', async () => {
    const wrapper = mount(StarOrbitStage, {
      props: {
        messages: [
          { role: 'user', content: '把这句记下来。', parts: [{ type: 'text', text: '把这句记下来。' }] },
          { role: 'assistant', content: '已经放进星图。', parts: [{ type: 'text', text: '已经放进星图。' }] },
        ],
        activeMessageIndex: null,
      },
    })

    await wrapper.get('button[aria-label="回看记忆：把这句记下来"]').trigger('click')

    expect(wrapper.get('.star-memory-popover').text()).toContain('把这句记下来。')
    expect(wrapper.get('.star-memory-popover').text()).toContain('已经放进星图。')
  })
})
