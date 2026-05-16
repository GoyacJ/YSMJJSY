import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StarChatMessage from './StarChatMessage.vue'

describe('StarChatMessage', () => {
  it('renders assistant text with a copy action', async () => {
    const message = {
      role: 'assistant' as const,
      content: '我还记得那片星空。',
      parts: [{ type: 'text' as const, text: '我还记得那片星空。' }],
    }
    const wrapper = mount(StarChatMessage, {
      props: {
        message,
        active: false,
      },
    })

    expect(wrapper.attributes('data-role')).toBe('assistant')
    expect(wrapper.text()).toContain('我还记得那片星空。')

    await wrapper.get('button[aria-label="复制消息"]').trigger('click')

    expect(wrapper.emitted('copy')).toEqual([[message]])
  })

  it('renders image, audio, music, video, status, and download actions', () => {
    const wrapper = mount(StarChatMessage, {
      props: {
        message: {
          role: 'assistant',
          content: '生成好了。',
          parts: [
            { type: 'status', text: '正在生成' },
            { type: 'image', base64: 'img' },
            { type: 'audio', base64: 'audio' },
            { type: 'music', base64: 'song' },
            { type: 'video', url: 'https://example.com/star.mp4' },
          ],
        },
        active: true,
      },
    })

    expect(wrapper.text()).toContain('正在生成')
    expect(wrapper.get('img[alt="生成的图片"]').attributes('src')).toBe('data:image/png;base64,img')
    expect(wrapper.get('audio[data-kind="audio"]').attributes('src')).toBe('data:audio/mpeg;base64,audio')
    expect(wrapper.get('audio[data-kind="music"]').attributes('src')).toBe('data:audio/mpeg;base64,song')
    expect(wrapper.get('video').attributes('src')).toBe('https://example.com/star.mp4')
    expect(wrapper.get('a[download="star-image.png"]').attributes('href')).toBe('data:image/png;base64,img')
    expect(wrapper.get('a[download="star-audio.mp3"]').attributes('href')).toBe('data:audio/mpeg;base64,audio')
    expect(wrapper.get('a[download="star-music.mp3"]').attributes('href')).toBe('data:audio/mpeg;base64,song')
    expect(wrapper.get('a[download="star-video.mp4"]').attributes('href')).toBe('https://example.com/star.mp4')
  })

  it('uses theater message classes for visual states', () => {
    const wrapper = mount(StarChatMessage, {
      props: {
        message: { role: 'user', content: '这是一封短笺。' },
        active: true,
      },
    })

    expect(wrapper.classes()).toContain('star-chat-message')
    expect(wrapper.attributes('data-active')).toBe('true')
    expect(wrapper.attributes('data-role')).toBe('user')
    expect(wrapper.get('.star-chat-message__copy').exists()).toBe(true)
  })

  it('renders user text as floating glyphs', () => {
    const wrapper = mount(StarChatMessage, {
      props: {
        message: {
          role: 'user',
          content: '今晚见',
          parts: [{ type: 'text', text: '今晚见' }],
        },
        active: false,
      },
    })

    expect(wrapper.classes()).toContain('star-chat-message--spell')
    expect(wrapper.get('.star-glyph-text[data-role="user"]').text()).toContain('今晚见')
  })

  it('renders assistant text with a magic orb', () => {
    const wrapper = mount(StarChatMessage, {
      props: {
        message: {
          role: 'assistant',
          content: '我在。',
          parts: [{ type: 'text', text: '我在。' }],
        },
        active: false,
      },
    })

    expect(wrapper.classes()).toContain('star-chat-message--magic')
    expect(wrapper.get('.star-chat-message__orb').exists()).toBe(true)
    expect(wrapper.get('.star-glyph-text[data-role="assistant"]').text()).toContain('我在。')
  })
})
