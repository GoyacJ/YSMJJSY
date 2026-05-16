import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StarComposer from './StarComposer.vue'

function mountComposer(props = {}) {
  return mount(StarComposer, {
    props: {
      input: '',
      pending: false,
      listening: false,
      mode: 'chat',
      selectedMediaKinds: [],
      attachmentMenuOpen: false,
      ...props,
    },
  })
}

describe('StarComposer', () => {
  it('renders multimodal controls and emits submit on Enter', async () => {
    const wrapper = mountComposer()

    expect(wrapper.get('button[aria-label="添加附件"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="语音输入"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="设计模式"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="听一听"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="画一张"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="做一段"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="写一首"]').exists()).toBe(true)
    expect(wrapper.get('textarea').attributes('placeholder')).toBe('把想说的话交给这片星空')

    await wrapper.get('textarea').setValue('第一行')
    await wrapper.get('textarea').trigger('keydown.enter')

    expect(wrapper.emitted('update:input')).toEqual([['第一行']])
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('keeps Shift Enter for new lines and switches design mode', async () => {
    const wrapper = mountComposer({ input: '第一行' })

    await wrapper.get('textarea').trigger('keydown.enter', { shiftKey: true })
    expect(wrapper.emitted('submit')).toBeUndefined()

    await wrapper.get('button[aria-label="设计模式"]').trigger('click')
    expect(wrapper.emitted('toggle-mode')).toHaveLength(1)
  })

  it('opens attachment options and emits attachment changes', async () => {
    const wrapper = mountComposer({ attachmentMenuOpen: true })

    expect(wrapper.get('label[aria-label="上传图片"]').exists()).toBe(true)
    expect(wrapper.get('label[aria-label="上传音频"]').exists()).toBe(true)
    expect(wrapper.get('label[aria-label="上传视频"]').exists()).toBe(true)

    await wrapper.get('button[aria-label="画一张"]').trigger('click')
    expect(wrapper.emitted('toggle-media-kind')).toEqual([['image']])
  })
})
