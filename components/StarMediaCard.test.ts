import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StarMediaCard from './StarMediaCard.vue'

describe('StarMediaCard', () => {
  it('shows an AI label for generated media', () => {
    const wrapper = mount(StarMediaCard, {
      props: {
        part: {
          type: 'image',
          url: 'https://example.com/image.png',
        },
      },
    })

    expect(wrapper.text()).toContain('AI 生成')
    expect(wrapper.get('a[aria-label="下载资源"]').attributes('download')).toBe('star-image.png')
  })
})
