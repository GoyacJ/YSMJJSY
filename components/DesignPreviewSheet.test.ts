import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DesignPreviewSheet from './DesignPreviewSheet.vue'

const schema = {
  version: 1,
  theme: 'star-letter',
  palette: 'rose-gold',
  title: '新的页面',
  subtitle: '预览内容',
  sections: [{ type: 'letter', text: '新的段落。' }],
} as const

describe('DesignPreviewSheet', () => {
  it('renders preview actions', () => {
    const wrapper = mount(DesignPreviewSheet, {
      props: { schema },
      global: {
        stubs: {
          DynamicStarPage: { props: ['schema'], template: '<div>{{ schema.title }}</div>' },
        },
      },
    })

    expect(wrapper.text()).toContain('新的页面')
    expect(wrapper.get('button[aria-label="保存这个设计"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="放弃"]').exists()).toBe(true)
  })

  it('emits confirm and cancel', async () => {
    const wrapper = mount(DesignPreviewSheet, {
      props: { schema },
      global: {
        stubs: {
          DynamicStarPage: true,
        },
      },
    })

    await wrapper.get('button[aria-label="保存这个设计"]').trigger('click')
    await wrapper.get('button[aria-label="放弃"]').trigger('click')

    expect(wrapper.emitted('confirm')).toBeTruthy()
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })
})
