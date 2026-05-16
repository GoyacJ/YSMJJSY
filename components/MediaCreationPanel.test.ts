import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MediaCreationPanel from './MediaCreationPanel.vue'

describe('MediaCreationPanel', () => {
  it('renders quota only', () => {
    const wrapper = mount(MediaCreationPanel, {
      global: {
        stubs: {
          MiniMaxQuotaPanel: {
            template: '<section class="quota-panel">星能量</section>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('星能量')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
