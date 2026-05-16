import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StarChat from './StarChat.vue'

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function mountStarChat(options: Parameters<typeof mount<typeof StarChat>>[1] = {}) {
  return mount(StarChat, {
    ...options,
    global: {
      ...(options.global || {}),
      stubs: {
        MediaCreationPanel: true,
        ...(options.global?.stubs || {}),
      },
    },
  })
}

describe('StarChat', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends user message and renders reply', async () => {
    const sendMessage = vi.fn(async () => ({ reply: '这封信是真的。' }))
    const wrapper = mountStarChat({
      props: {
        sendMessage,
      },
    })

    await wrapper.find('textarea').setValue('这封信是真的吗？')
    await wrapper.find('form').trigger('submit.prevent')

    expect(sendMessage).toHaveBeenCalledWith({ message: '这封信是真的吗？', attachments: [] })
    expect(wrapper.text()).toContain('这封信是真的')
  })

  it('shows bottom multimodal controls', () => {
    const wrapper = mountStarChat()

    expect(wrapper.classes()).toContain('star-chat--bottom')
    expect(wrapper.get('.star-chat__dock').exists()).toBe(true)
    expect(wrapper.get('label[aria-label="添加附件"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="语音输入"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="设计模式"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="发送"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('完全访问权限')
    expect(wrapper.get('textarea').attributes('placeholder')).toBe('要求后续变更')
  })

  it('sends selected image attachment with the message', async () => {
    const sendMessage = vi.fn(async () => ({ reply: '我看到了这张图。' }))
    const wrapper = mountStarChat({
      props: {
        sendMessage,
      },
    })

    class MockFileReader {
      result = 'data:image/png;base64,abc'
      onload: null | (() => void) = null
      onerror: null | (() => void) = null

      readAsDataURL() {
        this.onload?.()
      }
    }

    vi.stubGlobal('FileReader', MockFileReader)

    const input = wrapper.get('input[type="file"]')
    const file = new File(['abc'], 'star.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', {
      value: [file],
      configurable: true,
    })
    await input.trigger('change')
    await flushPromises()
    await wrapper.find('textarea').setValue('看看这张图')
    await wrapper.find('form').trigger('submit.prevent')

    expect(sendMessage).toHaveBeenCalledWith({
      message: '看看这张图',
      attachments: [{
        kind: 'image',
        dataUrl: 'data:image/png;base64,abc',
        name: 'star.png',
        mimeType: 'image/png',
      }],
    })
    expect(wrapper.text()).toContain('我看到了这张图。')
  })

  it('uses design mode placeholder and emits design requests', async () => {
    const wrapper = mountStarChat()

    await wrapper.get('button[aria-label="设计模式"]').trigger('click')

    expect(wrapper.get('textarea').attributes('placeholder')).toBe('请输入你的创意想法')

    await wrapper.find('textarea').setValue('把页面改成月光感')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.emitted('designRequested')?.[0]).toEqual(['把页面改成月光感'])
  })

  it('marks thread active after user interaction', async () => {
    const wrapper = mountStarChat()

    expect(wrapper.attributes('data-thread-active')).toBe('false')

    await wrapper.get('.star-chat__thread').trigger('click')

    expect(wrapper.attributes('data-thread-active')).toBe('true')
  })

  it('fills the input from browser speech recognition', async () => {
    class MockSpeechRecognition {
      lang = ''
      interimResults = false
      onresult: null | ((event: any) => void) = null
      onerror: null | (() => void) = null
      onend: null | (() => void) = null

      start() {
        this.onresult?.({ results: [[{ transcript: '我想问一句' }]] })
        this.onend?.()
      }

      abort() {}
    }

    vi.stubGlobal('webkitSpeechRecognition', MockSpeechRecognition)
    const wrapper = mountStarChat()

    await wrapper.get('button[aria-label="语音输入"]').trigger('click')

    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('我想问一句')
  })
})
