import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StarMemoryMap from './StarMemoryMap.vue'

describe('StarMemoryMap', () => {
  it('renders a memory planet button that opens the planet panel', async () => {
    const wrapper = mount(StarMemoryMap)

    expect(wrapper.get('button[aria-label="打开记忆星球"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('记忆星球')
    expect(wrapper.text()).toContain('记忆、反思和进化轨道')

    await wrapper.get('button[aria-label="打开记忆星球"]').trigger('click')

    expect(wrapper.emitted('open-planet')).toHaveLength(1)
  })

  it('keeps a separate settings action', async () => {
    const wrapper = mount(StarMemoryMap)
    const settings = wrapper.get('button[aria-label="打开星信设置"]')

    expect(settings.get('.star-memory-map__settings-label').text()).toBe('设置')

    await settings.trigger('click')

    expect(wrapper.emitted('open-settings')).toHaveLength(1)
  })

  it('overrides shared button spacing for the settings action', () => {
    const css = readFileSync(resolve(process.cwd(), 'assets/css/main.css'), 'utf8')

    expect(css).toContain('.star-memory-map button.star-memory-map__settings')
  })
})
