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
})
