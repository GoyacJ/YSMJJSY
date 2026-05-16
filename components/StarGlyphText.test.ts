import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StarGlyphText from './StarGlyphText.vue'

describe('StarGlyphText', () => {
  it('splits text into animated glyphs', () => {
    const wrapper = mount(StarGlyphText, {
      props: {
        text: '星信',
        role: 'user',
      },
    })

    const glyphs = wrapper.findAll('.star-glyph-text__glyph')
    expect(glyphs).toHaveLength(2)
    expect(glyphs.map(item => item.text())).toEqual(['星', '信'])
    expect(wrapper.attributes('data-role')).toBe('user')
    expect(glyphs[1].attributes('style')).toContain('--glyph-delay')
  })

  it('keeps whitespace visible', () => {
    const wrapper = mount(StarGlyphText, {
      props: {
        text: '星 信',
        role: 'assistant',
      },
    })

    expect(wrapper.text()).toContain('星 信')
    expect(wrapper.attributes('data-role')).toBe('assistant')
  })
})
