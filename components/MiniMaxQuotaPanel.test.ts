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

    expect(wrapper.text()).toContain('星能量')
    expect(wrapper.text()).toContain('语音')
    expect(wrapper.text()).toContain('图像')
    expect(wrapper.text()).toContain('音乐')
    expect(wrapper.text()).toContain('视频暂不可用')
    expect(wrapper.text()).toContain('语音已用 12/4000')
    expect(wrapper.text()).toContain('图像已用 2/50')
    expect(wrapper.text()).toContain('音乐已用 3/100')
    expect(wrapper.text()).not.toContain('星信已用 5/1500')
  })
})
