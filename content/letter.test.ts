import { describe, expect, it } from 'vitest'
import { finalConfession, letterParagraphs, memoryMoments } from './letter'
import { starLetterPersona } from './persona'

describe('letter content', () => {
  it('keeps the letter concise', () => {
    expect(letterParagraphs.length).toBeGreaterThanOrEqual(4)
    expect(letterParagraphs.every((item) => item.text.length <= 120)).toBe(true)
  })

  it('includes editorial Pretext layouts', () => {
    expect(letterParagraphs.some(item => item.layout === 'moon-wrap')).toBe(true)
    expect(letterParagraphs.some(item => item.layout === 'date-orbit')).toBe(true)
    expect(letterParagraphs.some(item => item.layout === 'star-trail')).toBe(true)
    expect(memoryMoments.length).toBeGreaterThanOrEqual(3)
  })

  it('keeps memory moments small', () => {
    expect(memoryMoments.length).toBeGreaterThanOrEqual(3)
    expect(memoryMoments.length).toBeLessThanOrEqual(5)
  })

  it('defines a final confession', () => {
    expect(finalConfession.title).toContain('喜欢')
  })

  it('sets a restrained persona', () => {
    expect(starLetterPersona).toContain('不强迫')
    expect(starLetterPersona).toContain('克制')
  })
})
