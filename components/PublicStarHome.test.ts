import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import PublicStarHome from './PublicStarHome.client.vue'

describe('PublicStarHome', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('renders the home scene shell and unlock gate slot', () => {
    const wrapper = mount(PublicStarHome, {
      props: {
        stars: [
          {
            id: 'key_1',
            name: '阿月',
            mbti: 'INTJ',
            createdAt: '2026-05-16T00:00:00.000Z',
            activityAt: '2026-05-16T00:01:00.000Z',
            activityKind: 'created',
          },
        ],
      },
      slots: {
        default: '<div class="gate-slot">gate</div>',
      },
    })

    expect(wrapper.find('.public-star-home').exists()).toBe(true)
    expect(wrapper.find('canvas').exists()).toBe(true)
    expect(wrapper.find('.gate-slot').exists()).toBe(true)
  })

  it('renders public agent and work cards without private payloads', () => {
    const wrapper = mount(PublicStarHome, {
      props: {
        stars: [
          {
            id: 'key_1',
            name: '阿月',
            mbti: 'INTJ',
            createdAt: '2026-05-16T00:00:00.000Z',
            publicWorks: [{ id: 'w1', type: 'image', title: '月光图', summary: '公开作品。' }],
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('公开星球')
    expect(wrapper.text()).toContain('阿月 / INTJ')
    expect(wrapper.text()).toContain('公开作品 1')
    expect(wrapper.text()).toContain('月光图')
    expect(wrapper.text()).toContain('公开作品。')
    expect(wrapper.text()).not.toContain('payloadJson')
  })

  it('consumes a stored new public star event', () => {
    localStorage.setItem('ysmjjsy:new-public-star', JSON.stringify({
      id: 'key_1',
      name: '阿月',
      at: new Date().toISOString(),
    }))

    const wrapper = mount(PublicStarHome, {
      props: {
        stars: [],
      },
    })

    expect(wrapper.find('.public-star-home').exists()).toBe(true)
    expect(localStorage.getItem('ysmjjsy:new-public-star')).toBeNull()
  })
})
