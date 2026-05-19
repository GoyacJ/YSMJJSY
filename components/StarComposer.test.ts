import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StarComposer from './StarComposer.vue'

function mountComposer(props = {}) {
  return mount(StarComposer, {
    props: {
      input: '',
      pending: false,
      listening: false,
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
    expect(wrapper.find('button[aria-label="设计模式"]').exists()).toBe(false)
    expect(wrapper.get('button[aria-label="生成语音"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="生成图片"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="生成视频"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="生成音乐"]').exists()).toBe(true)
    expect(wrapper.get('textarea').attributes('placeholder')).toBe('把想说的话交给这片星空')

    await wrapper.get('textarea').setValue('第一行')
    await wrapper.get('textarea').trigger('keydown.enter')

    expect(wrapper.emitted('update:input')).toEqual([['第一行']])
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('keeps text entry and send available while pending', async () => {
    const wrapper = mountComposer({ pending: true })

    await wrapper.get('textarea').setValue('排队发送')
    await wrapper.get('textarea').trigger('keydown.enter')

    expect(wrapper.get('textarea').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('button[aria-label="发送"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.emitted('update:input')).toEqual([['排队发送']])
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('keeps Shift Enter for new lines', async () => {
    const wrapper = mountComposer({ input: '第一行' })

    await wrapper.get('textarea').trigger('keydown.enter', { shiftKey: true })
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('opens attachment options and emits attachment changes', async () => {
    const wrapper = mountComposer({ attachmentMenuOpen: true })

    expect(wrapper.get('label[aria-label="上传图片"]').exists()).toBe(true)
    expect(wrapper.get('label[aria-label="上传音频"]').exists()).toBe(true)
    expect(wrapper.get('label[aria-label="上传视频"]').exists()).toBe(true)
    expect(wrapper.get('.star-chat__mobile-actions button[aria-label="语音输入"]').exists()).toBe(true)
    expect(wrapper.find('.star-chat__mobile-actions button[aria-label="设计模式"]').exists()).toBe(false)
    expect(wrapper.get('.star-chat__quick-tools button[aria-label="语音输入"]').exists()).toBe(true)

    await wrapper.get('button[aria-label="生成图片"]').trigger('click')
    expect(wrapper.emitted('toggle-media-kind')).toEqual([['image']])
  })

  it('marks selected media intent on the composer shell', () => {
    const wrapper = mountComposer({
      selectedMediaKinds: ['image'],
    })

    expect(wrapper.get('form').attributes('data-mode')).toBeUndefined()
    expect(wrapper.get('textarea').attributes('placeholder')).toBe('把想说的话交给这片星空')
    expect(wrapper.get('button[aria-label="生成图片"]').attributes('data-active')).toBe('true')
  })
})
