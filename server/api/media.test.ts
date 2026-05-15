import { describe, expect, it } from 'vitest'
import { normalizeMediaPrompt, toVideoTaskStatus } from '../services/media'

describe('media api helpers', () => {
  it('adds the visual style boundary to image prompts', () => {
    expect(normalizeMediaPrompt('画一张星空')).toContain('温柔')
  })

  it('maps provider video status', () => {
    expect(toVideoTaskStatus('Success')).toBe('succeeded')
    expect(toVideoTaskStatus('Fail')).toBe('failed')
  })
})
