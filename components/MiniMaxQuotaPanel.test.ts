import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MiniMaxQuotaPanel from './MiniMaxQuotaPanel.vue'

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe('MiniMaxQuotaPanel', () => {
  it('renders feature quota counts', async () => {
    const wrapper = mount(MiniMaxQuotaPanel, {
      props: {
        fetchQuota: async () => [
          { key: 'chat', label: '星信', used: 5, total: 1500, remaining: 1495, available: true },
          { key: 'audio', label: '听一听', used: 12, total: 4000, remaining: 3988, available: true },
          { key: 'image', label: '画一张', used: 2, total: 50, remaining: 48, available: true },
          { key: 'music', label: '写一首', used: 3, total: 100, remaining: 97, available: true },
          { key: 'video', label: '做一段', used: 0, total: 0, remaining: 0, available: false },
        ],
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('听一听')
    expect(wrapper.text()).toContain('3988/4000')
    expect(wrapper.text()).toContain('画一张')
    expect(wrapper.text()).toContain('48/50')
    expect(wrapper.text()).toContain('写一首')
    expect(wrapper.text()).toContain('97/100')
    expect(wrapper.text()).toContain('做一段')
    expect(wrapper.text()).toContain('暂不可用')
    expect(wrapper.text()).not.toContain('1495/1500')
  })
})
