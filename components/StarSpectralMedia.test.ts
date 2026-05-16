import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StarSpectralMedia from './StarSpectralMedia.vue'

describe('StarSpectralMedia', () => {
  it('renders an image memory shard with download support', () => {
    const wrapper = mount(StarSpectralMedia, {
      props: {
        part: { type: 'image', base64: 'img' },
      },
    })

    expect(wrapper.get('.star-spectral-media').attributes('data-kind')).toBe('image')
    expect(wrapper.get('img[alt="生成的图片"]').attributes('src')).toBe('data:image/png;base64,img')
    expect(wrapper.get('a[download="star-image.png"]').attributes('href')).toBe('data:image/png;base64,img')
  })

  it('renders audio and music through the star audio player', () => {
    const audio = mount(StarSpectralMedia, {
      props: {
        part: { type: 'audio', base64: 'audio' },
      },
    })
    const music = mount(StarSpectralMedia, {
      props: {
        part: { type: 'music', base64: 'song' },
      },
    })

    expect(audio.get('audio[data-kind="audio"]').attributes('src')).toBe('data:audio/mpeg;base64,audio')
    expect(music.get('audio[data-kind="music"]').attributes('src')).toBe('data:audio/mpeg;base64,song')
  })

  it('renders video with controls and download support', () => {
    const wrapper = mount(StarSpectralMedia, {
      props: {
        part: { type: 'video', url: 'https://example.com/star.mp4' },
      },
    })

    expect(wrapper.get('video').attributes('src')).toBe('https://example.com/star.mp4')
    expect(wrapper.get('video').attributes()).toHaveProperty('controls')
    expect(wrapper.get('a[download="star-video.mp4"]').attributes('href')).toBe('https://example.com/star.mp4')
  })
})
