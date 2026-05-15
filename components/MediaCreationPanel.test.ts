import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GeneratedAsset from './GeneratedAsset.vue'
import MediaCreationPanel from './MediaCreationPanel.vue'

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe('MediaCreationPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete (globalThis as any).$fetch
  })

  it('shows four media actions', () => {
    const wrapper = mount(MediaCreationPanel)

    expect(wrapper.text()).toContain('听一听')
    expect(wrapper.text()).toContain('画一张')
    expect(wrapper.text()).toContain('做一段')
    expect(wrapper.text()).toContain('写一首')
  })

  it('renders generated image after the request succeeds', async () => {
    ;(globalThis as any).$fetch = vi.fn(async () => ({ url: 'https://example.com/star.png' }))
    const wrapper = mount(MediaCreationPanel, {
      global: {
        components: {
          GeneratedAsset,
        },
      },
    })

    await wrapper.get('button:nth-child(2)').trigger('click')
    await flushPromises()

    expect(wrapper.find('.generated-asset').attributes('data-status')).toBe('succeeded')
    expect(wrapper.find('img').attributes('src')).toBe('https://example.com/star.png')
  })
})
