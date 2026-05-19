import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StarChat from './StarChat.vue'

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function mountStarChat(options: Parameters<typeof mount<typeof StarChat>>[1] = {}) {
  return mount(StarChat, {
    ...options,
  })
}

function createStreamReply(reply: string, message = {
  role: 'assistant' as const,
  content: reply,
  parts: [{ type: 'text' as const, text: reply }],
}) {
  return vi.fn(async (_payload, onEvent) => {
    onEvent({ type: 'message', reply, message })
    return { reply, message }
  })
}

describe('StarChat', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    delete (globalThis as any).$fetch
  })

  it('sends user message and renders reply', async () => {
    const sendMessageStream = createStreamReply('这封信是真的。')
    const wrapper = mountStarChat({
      props: {
        sendMessageStream,
      },
    })

    await wrapper.find('textarea').setValue('这封信是真的吗？')
    await wrapper.find('form').trigger('submit.prevent')

    expect(sendMessageStream).toHaveBeenCalledWith({ message: '这封信是真的吗？', attachments: [], intent: 'auto' }, expect.any(Function))
    expect(wrapper.text()).toContain('这封信是真的')
    expect(wrapper.find('.star-chat__header').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('这封信里的星光')
  })

  it('renders saved messages from the current key', () => {
    const wrapper = mountStarChat({
      props: {
        initialMessages: [
          { role: 'user', content: '昨晚说到星空。' },
          {
            role: 'assistant',
            content: '我还记得那片星空。',
            parts: [{ type: 'text' as const, text: '我还记得那片星空。' }],
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('昨晚说到星空。')
    expect(wrapper.text()).toContain('我还记得那片星空。')
  })

  it('renders the orbit stage instead of the old letter surface', () => {
    const wrapper = mountStarChat({
      props: {
        initialMessages: [
          { role: 'user', content: '今晚见。', parts: [{ type: 'text' as const, text: '今晚见。' }] },
          { role: 'assistant', content: '我在星光里。', parts: [{ type: 'text' as const, text: '我在星光里。' }] },
        ],
      },
    })

    expect(wrapper.get('.star-orbit-stage').exists()).toBe(true)
    expect(wrapper.text()).toContain('今晚见。')
    expect(wrapper.text()).toContain('我在星光里。')
    expect(wrapper.text()).not.toContain('这里会慢慢写下只属于这把钥匙的内容。')
  })

  it('renders structured text and audio parts in the orbit stage', async () => {
    const sendMessageStream = createStreamReply('先慢慢呼吸。', {
        role: 'assistant' as const,
        content: '先慢慢呼吸。',
        parts: [
          { type: 'text' as const, text: '先慢慢呼吸。' },
          { type: 'audio' as const, base64: 'abc' },
        ],
      })
    const wrapper = mountStarChat({ props: { sendMessageStream } })

    await wrapper.find('textarea').setValue('读给我听')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('先慢慢呼吸。')
    expect(wrapper.get('audio').attributes('src')).toBe('data:audio/mpeg;base64,abc')
  })

  it('renders image, music, video, and status parts in assistant messages', async () => {
    const sendMessageStream = createStreamReply('生成好了。', {
        role: 'assistant' as const,
        content: '生成好了。',
        parts: [
          { type: 'status' as const, text: '正在生成' },
          { type: 'image' as const, base64: 'img' },
          { type: 'music' as const, base64: 'song' },
          { type: 'video' as const, url: 'https://example.com/star.mp4' },
        ],
      })
    const wrapper = mountStarChat({ props: { sendMessageStream } })

    await wrapper.find('textarea').setValue('画一张星空')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('正在生成')
    expect(wrapper.get('img[alt="生成的图片"]').attributes('src')).toBe('data:image/png;base64,img')
    expect(wrapper.get('audio[data-kind="music"]').attributes('src')).toBe('data:audio/mpeg;base64,song')
    expect(wrapper.get('video').attributes('src')).toBe('https://example.com/star.mp4')
  })

  it('restores media parts with download links from saved messages', () => {
    const wrapper = mountStarChat({
      props: {
        initialMessages: [{
          role: 'assistant',
          content: '生成好了。',
          parts: [
            { type: 'text' as const, text: '生成好了。' },
            { type: 'image' as const, base64: 'img' },
            { type: 'audio' as const, base64: 'audio' },
            { type: 'music' as const, base64: 'song' },
            { type: 'video' as const, url: 'https://example.com/star.mp4' },
          ],
        }],
      },
    })

    expect(wrapper.get('img[alt="生成的图片"]').attributes('src')).toBe('data:image/png;base64,img')
    expect(wrapper.get('audio[data-kind="audio"]').attributes('src')).toBe('data:audio/mpeg;base64,audio')
    expect(wrapper.get('audio[data-kind="music"]').attributes('src')).toBe('data:audio/mpeg;base64,song')
    expect(wrapper.get('video').attributes('src')).toBe('https://example.com/star.mp4')
    expect(wrapper.get('a[download="star-image.png"]').attributes('href')).toBe('data:image/png;base64,img')
    expect(wrapper.get('a[download="star-audio.mp3"]').attributes('href')).toBe('data:audio/mpeg;base64,audio')
    expect(wrapper.get('a[download="star-music.mp3"]').attributes('href')).toBe('data:audio/mpeg;base64,song')
    expect(wrapper.get('a[download="star-video.mp4"]').attributes('href')).toBe('https://example.com/star.mp4')
  })

  it('copies a message from the message action button', async () => {
    const writeText = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', {
      clipboard: { writeText },
    })
    const wrapper = mountStarChat({
      props: {
        initialMessages: [{ role: 'assistant', content: '我还记得那片星空。' }],
      },
    })

    await wrapper.get('button[aria-label="复制消息"]').trigger('click')

    expect(writeText).toHaveBeenCalledWith('我还记得那片星空。')
  })

  it('shows bottom multimodal controls', () => {
    const wrapper = mountStarChat()

    expect(wrapper.classes()).toContain('star-chat--bottom')
    expect(wrapper.get('.star-chat__dock').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="添加附件"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="语音输入"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="设计模式"]').exists()).toBe(false)
    expect(wrapper.get('button[aria-label="听一听"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="画一张"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="做一段"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="写一首"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="发送"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('完全访问权限')
    expect(wrapper.get('textarea').attributes('placeholder')).toBe('把想说的话交给这片星空')
  })

  it('opens attachment options from the plus button', async () => {
    const wrapper = mountStarChat()

    expect(wrapper.find('.star-chat__attachment-popover').exists()).toBe(false)

    await wrapper.get('button[aria-label="添加附件"]').trigger('click')

    expect(wrapper.get('.star-chat__attachment-popover').exists()).toBe(true)
    expect(wrapper.get('label[aria-label="上传图片"]').exists()).toBe(true)
    expect(wrapper.get('label[aria-label="上传音频"]').exists()).toBe(true)
    expect(wrapper.get('label[aria-label="上传视频"]').exists()).toBe(true)
  })

  it('closes attachment options when clicking outside', async () => {
    const wrapper = mountStarChat({
      attachTo: document.body,
    })

    await wrapper.get('button[aria-label="添加附件"]').trigger('click')
    expect(wrapper.find('.star-chat__attachment-popover').exists()).toBe(true)

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.star-chat__attachment-popover').exists()).toBe(false)

    wrapper.unmount()
  })

  it('sends with Enter and keeps Shift Enter for new lines', async () => {
    const sendMessageStream = createStreamReply('收到。')
    const wrapper = mountStarChat({
      props: {
        sendMessageStream,
      },
    })
    const textarea = wrapper.find('textarea')

    await textarea.setValue('第一行')
    await textarea.trigger('keydown.enter', { shiftKey: true })

    expect(sendMessageStream).not.toHaveBeenCalled()

    await textarea.trigger('keydown.enter')

    expect(sendMessageStream).toHaveBeenCalledWith({ message: '第一行', attachments: [], intent: 'auto' }, expect.any(Function))
  })

  it('sends selected image attachment with the message', async () => {
    const sendMessageStream = createStreamReply('我看到了这张图。')
    const wrapper = mountStarChat({
      props: {
        sendMessageStream,
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

    await wrapper.get('button[aria-label="添加附件"]').trigger('click')
    const input = wrapper.get('input[accept="image/png,image/jpeg,image/webp"]')
    const file = new File(['abc'], 'star.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', {
      value: [file],
      configurable: true,
    })
    await input.trigger('change')
    await flushPromises()
    await wrapper.find('textarea').setValue('看看这张图')
    await wrapper.find('form').trigger('submit.prevent')

    expect(sendMessageStream).toHaveBeenCalledWith({
      message: '看看这张图',
      intent: 'auto',
      attachments: [{
        kind: 'image',
        dataUrl: 'data:image/png;base64,abc',
        name: 'star.png',
        mimeType: 'image/png',
      }],
    }, expect.any(Function))
    expect(wrapper.text()).toContain('我看到了这张图。')
  })

  it('does not expose design mode from the chat composer', async () => {
    const sendMessageStream = createStreamReply('收到。')
    const wrapper = mountStarChat({
      props: {
        sendMessageStream,
      },
    })

    expect(wrapper.find('button[aria-label="设计模式"]').exists()).toBe(false)
    expect(wrapper.get('textarea').attributes('placeholder')).toBe('把想说的话交给这片星空')
    await wrapper.find('textarea').setValue('把页面改成月光感')
    await wrapper.find('form').trigger('submit.prevent')

    expect(sendMessageStream).toHaveBeenCalledWith({
      message: '把页面改成月光感',
      attachments: [],
      intent: 'auto',
    }, expect.any(Function))
  })

  it('sends selected media intent through the chat request only', async () => {
    const sendMessageStream = createStreamReply('画好了。', {
        role: 'assistant' as const,
        content: '画好了。',
        parts: [{ type: 'image' as const, url: 'https://example.com/star.png' }],
      })
    vi.stubGlobal('fetch', vi.fn())
    const wrapper = mountStarChat({
      props: {
        sendMessageStream,
      },
    })

    await wrapper.get('button[aria-label="画一张"]').trigger('click')
    await wrapper.find('textarea').setValue('月光星空')
    await wrapper.find('form').trigger('submit.prevent')

    expect(sendMessageStream).toHaveBeenCalledWith({
      message: '月光星空',
      attachments: [],
      intent: 'image',
    }, expect.any(Function))
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('renders streamed reply deltas before the final message', async () => {
    let continueStream!: () => void
    const streamGate = new Promise<void>((resolve) => {
      continueStream = resolve
    })
    const sendMessageStream = vi.fn(async (_payload, onEvent) => {
      onEvent({ type: 'delta', text: '你' })
      await streamGate
      onEvent({ type: 'delta', text: '好' })
      onEvent({
        type: 'message',
        reply: '你好',
        message: {
          role: 'assistant' as const,
          content: '你好',
          parts: [{ type: 'text' as const, text: '你好' }],
        },
      })
      return {
        reply: '你好',
        message: {
          role: 'assistant' as const,
          content: '你好',
          parts: [{ type: 'text' as const, text: '你好' }],
        },
      }
    })
    const wrapper = mountStarChat({
      props: {
        sendMessageStream,
      },
    })

    await wrapper.find('textarea').setValue('在吗')
    const submitPromise = wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(sendMessageStream).toHaveBeenCalledWith(
      { message: '在吗', attachments: [], intent: 'auto' },
      expect.any(Function),
    )
    expect(wrapper.text()).toContain('你')
    expect(wrapper.text()).not.toContain('你好')

    continueStream()
    await submitPromise
    await flushPromises()

    expect(wrapper.text()).toContain('你好')
  })

  it('queues a second message while the first reply is still streaming', async () => {
    let finishFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      finishFirst = resolve
    })
    const sendMessageStream = vi.fn(async (payload, onEvent) => {
      if (payload.message === '第一条') {
        await firstGate
        onEvent({
          type: 'message',
          reply: '第一条回复',
          message: {
            role: 'assistant' as const,
            content: '第一条回复',
            parts: [{ type: 'text' as const, text: '第一条回复' }],
          },
        })
        return {
          reply: '第一条回复',
          message: {
            role: 'assistant' as const,
            content: '第一条回复',
            parts: [{ type: 'text' as const, text: '第一条回复' }],
          },
        }
      }

      onEvent({
        type: 'message',
        reply: '第二条回复',
        message: {
          role: 'assistant' as const,
          content: '第二条回复',
          parts: [{ type: 'text' as const, text: '第二条回复' }],
        },
      })
      return {
        reply: '第二条回复',
        message: {
          role: 'assistant' as const,
          content: '第二条回复',
          parts: [{ type: 'text' as const, text: '第二条回复' }],
        },
      }
    })
    const wrapper = mountStarChat({
      props: {
        sendMessageStream,
      },
    })

    await wrapper.find('textarea').setValue('第一条')
    const firstSubmit = wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    await wrapper.find('textarea').setValue('第二条')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(sendMessageStream).toHaveBeenCalledTimes(1)
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
    expect(wrapper.text()).toContain('第二条')

    finishFirst()
    await firstSubmit
    await flushPromises()

    expect(sendMessageStream).toHaveBeenNthCalledWith(2, {
      message: '第二条',
      attachments: [],
      intent: 'auto',
    }, expect.any(Function))
    expect(wrapper.text()).toContain('第一条回复')
    expect(wrapper.text()).toContain('第二条回复')
  })

  it('shows queued messages above the composer while waiting to send', async () => {
    let finishFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      finishFirst = resolve
    })
    const sendMessageStream = vi.fn(async (payload, onEvent) => {
      if (payload.message === '第一条') {
        await firstGate
      }

      const reply = `${payload.message}回复`
      onEvent({
        type: 'message',
        reply,
        message: {
          role: 'assistant' as const,
          content: reply,
          parts: [{ type: 'text' as const, text: reply }],
        },
      })
      return {
        reply,
        message: {
          role: 'assistant' as const,
          content: reply,
          parts: [{ type: 'text' as const, text: reply }],
        },
      }
    })
    const wrapper = mountStarChat({
      props: {
        sendMessageStream,
      },
    })

    await wrapper.find('textarea').setValue('第一条')
    const firstSubmit = wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    await wrapper.find('textarea').setValue('第二条')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    const queue = wrapper.get('.star-chat__queue')
    expect(queue.text()).toContain('排队中')
    expect(queue.text()).toContain('第二条')

    finishFirst()
    await firstSubmit
    await flushPromises()

    expect(wrapper.find('.star-chat__queue').exists()).toBe(false)
  })

  it('removes a queued message before it is sent', async () => {
    let finishFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      finishFirst = resolve
    })
    const sendMessageStream = vi.fn(async (payload, onEvent) => {
      if (payload.message === '第一条') {
        await firstGate
      }

      const reply = `${payload.message}回复`
      onEvent({
        type: 'message',
        reply,
        message: {
          role: 'assistant' as const,
          content: reply,
          parts: [{ type: 'text' as const, text: reply }],
        },
      })
      return {
        reply,
        message: {
          role: 'assistant' as const,
          content: reply,
          parts: [{ type: 'text' as const, text: reply }],
        },
      }
    })
    const wrapper = mountStarChat({
      props: {
        sendMessageStream,
      },
    })

    await wrapper.find('textarea').setValue('第一条')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    await wrapper.find('textarea').setValue('第二条')
    await wrapper.find('form').trigger('submit.prevent')
    await wrapper.find('textarea').setValue('第三条')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    await wrapper.get('button[aria-label="删除排队消息：第二条"]').trigger('click')

    expect(wrapper.get('.star-chat__queue').text()).not.toContain('第二条')
    expect(wrapper.get('.star-chat__queue').text()).toContain('第三条')

    finishFirst()
    await flushPromises()
    await flushPromises()

    expect(sendMessageStream).toHaveBeenCalledTimes(2)
    expect(sendMessageStream).toHaveBeenNthCalledWith(2, {
      message: '第三条',
      attachments: [],
      intent: 'auto',
    }, expect.any(Function))
    expect(wrapper.text()).not.toContain('第二条回复')
    expect(wrapper.text()).toContain('第三条回复')
  })

  it('shows contextual thinking status before the assistant reply starts', async () => {
    let continueStream!: () => void
    const streamGate = new Promise<void>((resolve) => {
      continueStream = resolve
    })
    const sendMessageStream = vi.fn(async (_payload, onEvent) => {
      await streamGate
      onEvent({
        type: 'message',
        reply: '我在。',
        message: {
          role: 'assistant' as const,
          content: '我在。',
          parts: [{ type: 'text' as const, text: '我在。' }],
        },
      })
      return {
        reply: '我在。',
        message: {
          role: 'assistant' as const,
          content: '我在。',
          parts: [{ type: 'text' as const, text: '我在。' }],
        },
      }
    })
    const wrapper = mountStarChat({
      props: {
        sendMessageStream,
      },
    })

    await wrapper.find('textarea').setValue('今晚想听你说话')
    const submitPromise = wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('正在读你的话')
    expect(wrapper.text()).toContain('在星光里组织一句回复')
    expect(wrapper.text()).not.toContain('我在。')

    continueStream()
    await submitPromise
    await flushPromises()

    expect(wrapper.text()).toContain('我在。')
    expect(wrapper.text()).not.toContain('正在读你的话')
  })

  it('adapts thinking status for image attachments and audio intent', async () => {
    let continueStream!: () => void
    const streamGate = new Promise<void>((resolve) => {
      continueStream = resolve
    })
    const sendMessageStream = vi.fn(async (_payload, onEvent) => {
      await streamGate
      onEvent({
        type: 'message',
        reply: '我看见了。',
        message: {
          role: 'assistant' as const,
          content: '我看见了。',
          parts: [{ type: 'text' as const, text: '我看见了。' }],
        },
      })
      return {
        reply: '我看见了。',
        message: {
          role: 'assistant' as const,
          content: '我看见了。',
          parts: [{ type: 'text' as const, text: '我看见了。' }],
        },
      }
    })
    const wrapper = mountStarChat({
      props: {
        sendMessageStream,
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

    await wrapper.get('button[aria-label="添加附件"]').trigger('click')
    const input = wrapper.get('input[accept="image/png,image/jpeg,image/webp"]')
    Object.defineProperty(input.element, 'files', {
      value: [new File(['abc'], 'star.png', { type: 'image/png' })],
      configurable: true,
    })
    await input.trigger('change')
    await flushPromises()
    await wrapper.get('button[aria-label="听一听"]').trigger('click')
    await wrapper.find('textarea').setValue('看看这张图，再读给我听')
    const submitPromise = wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('正在看你发来的图片')
    expect(wrapper.text()).toContain('先写好回复，再把它变成声音')

    continueStream()
    await submitPromise
    await flushPromises()

    expect(wrapper.text()).toContain('我看见了。')
    expect(wrapper.text()).not.toContain('正在看你发来的图片')
  })

  it('lets the page paint between streamed text events from one response chunk', async () => {
    const frames: FrameRequestCallback[] = []
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode([
          'data: {"type":"delta","text":"你"}',
          'data: {"type":"delta","text":"好"}',
          'data: {"type":"message","reply":"你好","message":{"role":"assistant","content":"你好","parts":[{"type":"text","text":"你好"}]}}',
          'data: [DONE]',
          '',
        ].join('\n\n')))
        controller.close()
      },
    })

    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    }))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })))

    const wrapper = mountStarChat()

    await wrapper.find('textarea').setValue('在吗')
    const submitPromise = wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('你')
    expect(wrapper.text()).not.toContain('你好')

    frames.shift()?.(performance.now())
    await submitPromise
    await flushPromises()

    expect(wrapper.text()).toContain('你好')
  })

  it('renders a streamed text chunk one visible character per frame', async () => {
    const frames: FrameRequestCallback[] = []
    const sendMessageStream = vi.fn(async (_payload, onEvent) => {
      await onEvent({ type: 'delta', text: '你好呀' })
      await onEvent({
        type: 'message',
        reply: '你好呀',
        message: {
          role: 'assistant' as const,
          content: '你好呀',
          parts: [{ type: 'text' as const, text: '你好呀' }],
        },
      })
      return {
        reply: '你好呀',
        message: {
          role: 'assistant' as const,
          content: '你好呀',
          parts: [{ type: 'text' as const, text: '你好呀' }],
        },
      }
    })

    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    }))

    const wrapper = mountStarChat({
      props: {
        sendMessageStream,
      },
    })

    await wrapper.find('textarea').setValue('在吗')
    const submitPromise = wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('你')
    expect(wrapper.text()).not.toContain('你好')

    frames.shift()?.(performance.now())
    await flushPromises()
    expect(wrapper.text()).toContain('你好')
    expect(wrapper.text()).not.toContain('你好呀')

    frames.shift()?.(performance.now())
    await flushPromises()
    expect(wrapper.text()).toContain('你好呀')

    frames.shift()?.(performance.now())
    await submitPromise
  })

  it('renders stream status events before final media message', async () => {
    const sendMessageStream = vi.fn(async (_payload, onEvent) => {
      onEvent({ type: 'status', text: '正在画一张。' })
      await flushPromises()
      onEvent({
        type: 'message',
        reply: '画好了。',
        message: {
          role: 'assistant' as const,
          content: '画好了。',
          parts: [
            { type: 'text' as const, text: '画好了。' },
            { type: 'image' as const, url: 'https://example.com/star.png' },
          ],
        },
      })
      return {
        reply: '画好了。',
        message: {
          role: 'assistant' as const,
          content: '画好了。',
          parts: [
            { type: 'text' as const, text: '画好了。' },
            { type: 'image' as const, url: 'https://example.com/star.png' },
          ],
        },
      }
    })
    const wrapper = mountStarChat({ props: { sendMessageStream } })

    await wrapper.get('button[aria-label="画一张"]').trigger('click')
    await wrapper.find('textarea').setValue('月光星空')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('画好了。')
    expect(wrapper.get('img[alt="生成的图片"]').attributes('src')).toBe('https://example.com/star.png')
  })

  it('adds a streamed tool confirmation card and approves it inline', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 200 }))
    const sendMessageStream = vi.fn(async (_payload, onEvent) => {
      await onEvent({
        type: 'tool-confirmation',
        taskId: 'task_1',
        inboxItemId: 'task_approval:task_1',
        title: '发布作品',
        summary: '发布前需要确认。',
      })
      return { reply: '' }
    })
    vi.stubGlobal('fetch', fetch)
    const wrapper = mountStarChat({ props: { sendMessageStream } })

    await wrapper.find('textarea').setValue('发布这张图')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('发布作品')
    expect(wrapper.text()).toContain('发布前需要确认。')

    await wrapper.get('button[aria-label="批准工具请求"]').trigger('click')

    expect(fetch).toHaveBeenCalledWith('/api/agents/current/inbox/task_approval%3Atask_1/approve', {
      method: 'POST',
      headers: expect.any(Object),
    })
  })

  it('rejects streamed tool confirmations inline', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 200 }))
    const sendMessageStream = vi.fn(async (_payload, onEvent) => {
      await onEvent({
        type: 'tool-confirmation',
        taskId: 'task_2',
        inboxItemId: 'task_approval:task_2',
        title: '发布作品',
        summary: '暂不发布。',
      })
      return { reply: '' }
    })
    vi.stubGlobal('fetch', fetch)
    const wrapper = mountStarChat({ props: { sendMessageStream } })

    await wrapper.find('textarea').setValue('先别发布')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()
    await wrapper.get('button[aria-label="拒绝工具请求"]').trigger('click')

    expect(fetch).toHaveBeenCalledWith('/api/agents/current/inbox/task_approval%3Atask_2/reject', {
      method: 'POST',
      headers: expect.any(Object),
    })
  })

  it('marks thread active after user interaction', async () => {
    const sendMessageStream = createStreamReply('这封信是真的。')
    const wrapper = mountStarChat({
      props: {
        sendMessageStream,
      },
    })

    expect(wrapper.attributes('data-thread-active')).toBe('false')

    await wrapper.find('textarea').setValue('这封信是真的吗？')
    await wrapper.find('form').trigger('submit.prevent')
    await wrapper.get('.star-orbit-stage').trigger('click')

    expect(wrapper.attributes('data-thread-active')).toBe('true')
  })

  it('keeps the message thread on the latest message', async () => {
    const scrollTo = vi.fn()
    const originalScrollTo = HTMLElement.prototype.scrollTo
    const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')
    const sendMessageStream = createStreamReply('第二条回复。')
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 360,
    })
    HTMLElement.prototype.scrollTo = scrollTo
    const wrapper = mountStarChat({
      props: {
        sendMessageStream,
      },
    })

    try {
      await wrapper.find('textarea').setValue('第一条消息')
      await wrapper.find('form').trigger('submit.prevent')
      await flushPromises()

      expect(scrollTo).toHaveBeenLastCalledWith({ top: 360, behavior: 'smooth' })
      expect(wrapper.get('.star-orbit-stage').exists()).toBe(true)
    }
    finally {
      HTMLElement.prototype.scrollTo = originalScrollTo

      if (originalScrollHeight) {
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight)
      }
    }
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
