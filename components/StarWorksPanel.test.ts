import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StarWorksPanel from './StarWorksPanel.vue'

describe('StarWorksPanel', () => {
  it('renders music works with playable previews in the list', () => {
    const wrapper = mount(StarWorksPanel, {
      props: {
        works: [{
          id: 'work_1',
          type: 'music',
          title: '夜航',
          summary: '一首歌。',
          previewUrl: 'https://example.com/song.mp3',
          visibility: 'private',
          createdAt: '2026-05-19T00:00:00.000Z',
          updatedAt: '2026-05-19T00:00:00.000Z',
        }],
      },
    })

    const audio = wrapper.get('.star-works-panel__list audio[data-kind="music"]')

    expect(audio.attributes('src')).toBe('https://example.com/song.mp3')
  })
})
