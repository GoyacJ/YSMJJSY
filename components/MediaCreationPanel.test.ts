import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MediaCreationPanel from './MediaCreationPanel.vue'

describe('MediaCreationPanel', () => {
  it('shows four media actions', () => {
    const wrapper = mount(MediaCreationPanel)

    expect(wrapper.text()).toContain('听一听')
    expect(wrapper.text()).toContain('画一张')
    expect(wrapper.text()).toContain('做一段')
    expect(wrapper.text()).toContain('写一首')
  })
})
