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
    expect(wrapper.get('.star-memory-popover').attributes('style')).toContain('--memory-popover-x: 18%')
    expect(wrapper.get('.star-memory-popover').attributes('style')).toContain('--memory-popover-y: 18%')

    const closeButton = wrapper.get('button[aria-label="关闭记忆回看"]')

    expect(closeButton.text()).toBe('×')
    expect(closeButton.classes()).toContain('dialog-close-button')
  })

  it('closes the memory recap when the stage background is clicked', async () => {
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
    await wrapper.get('.star-orbit-stage__field').trigger('click')

    expect(wrapper.find('.star-memory-popover').exists()).toBe(false)
  })

  it('closes the memory recap when another page area is clicked', async () => {
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
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.star-memory-popover').exists()).toBe(false)
  })

  it('keeps the memory recap open when the recap itself is clicked', async () => {
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
    await wrapper.get('.star-memory-popover').trigger('click')

    expect(wrapper.find('.star-memory-popover').exists()).toBe(true)
  })

  it('keeps old rounds as memory stars instead of crowding the stage', () => {
    const messages = Array.from({ length: 4 }).flatMap((_, index) => [
      { role: 'user' as const, content: `第${index + 1}句话`, parts: [{ type: 'text' as const, text: `第${index + 1}句话` }] },
      { role: 'assistant' as const, content: `第${index + 1}句回复`, parts: [{ type: 'text' as const, text: `第${index + 1}句回复` }] },
    ])
    const wrapper = mount(StarOrbitStage, {
      props: {
        messages,
        activeMessageIndex: null,
      },
    })

    expect(wrapper.findAll('.star-orbit-group')).toHaveLength(2)
    expect(wrapper.findAll('.star-memory-constellation__star')).toHaveLength(4)
    expect(wrapper.text()).not.toContain('第1句话')
    expect(wrapper.text()).toContain('第4句话')
  })

  it('keeps the visible conversation away from screen edges and the composer zone', () => {
    const wrapper = mount(StarOrbitStage, {
      props: {
        messages: [
          { role: 'user', content: '第一句', parts: [{ type: 'text', text: '第一句' }] },
          { role: 'assistant', content: '第一句回复', parts: [{ type: 'text', text: '第一句回复' }] },
          { role: 'user', content: '第二句', parts: [{ type: 'text', text: '第二句' }] },
          { role: 'assistant', content: '第二句回复', parts: [{ type: 'text', text: '第二句回复' }] },
        ],
        activeMessageIndex: null,
      },
    })

    const groups = wrapper.findAll('.star-orbit-group')

    expect(groups[0].attributes('style')).toContain('--orbit-x: 36%')
    expect(groups[0].attributes('style')).toContain('--orbit-y: 36%')
    expect(groups.at(-1)?.attributes('style')).toContain('--orbit-x: 62%')
    expect(groups.at(-1)?.attributes('style')).toContain('--orbit-y: 52%')
  })

  it('does not inherit standard chat message layout inside the orbit stage', () => {
    const wrapper = mount(StarOrbitStage, {
      props: {
        messages: [
          { role: 'user', content: '给我写一首长一点的歌', parts: [{ type: 'text', text: '给我写一首长一点的歌' }] },
          {
            role: 'assistant',
            content: '可以，把它的词写给你。站在这端的我们，把远处的光一点点收回来。',
            parts: [{ type: 'text', text: '可以，把它的词写给你。站在这端的我们，把远处的光一点点收回来。' }],
          },
        ],
        activeMessageIndex: null,
      },
    })

    expect(wrapper.get('.star-orbit-stage__field').classes()).not.toContain('star-chat__messages')
  })

  it('spreads memory stars across the full stage', () => {
    const wrapper = mount(StarOrbitStage, {
      props: {
        messages: [
          { role: 'user', content: '第一句', parts: [{ type: 'text', text: '第一句' }] },
          { role: 'assistant', content: '第一句回复', parts: [{ type: 'text', text: '第一句回复' }] },
          { role: 'user', content: '第二句', parts: [{ type: 'text', text: '第二句' }] },
          { role: 'assistant', content: '第二句回复', parts: [{ type: 'text', text: '第二句回复' }] },
        ],
        activeMessageIndex: null,
      },
    })

    const memoryStars = wrapper.findAll('.star-memory-constellation__star')

    expect(memoryStars[0].attributes('style')).toContain('--orbit-y: 18%')
    expect(memoryStars[1].attributes('style')).toContain('--orbit-x: 82%')
  })
})
