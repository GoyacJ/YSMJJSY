import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StarMemoryMap from './StarMemoryMap.vue'

describe('StarMemoryMap', () => {
  it('renders a memory star-map button that opens settings', async () => {
    const wrapper = mount(StarMemoryMap)

    expect(wrapper.get('button[aria-label="打开记忆星图"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('记忆星图')

    await wrapper.get('button[aria-label="打开记忆星图"]').trigger('click')

    expect(wrapper.emitted('open-settings')).toHaveLength(1)
  })
})
