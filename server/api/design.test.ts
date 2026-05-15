import { describe, expect, it } from 'vitest'
import { createDefaultDesignSchema } from '../services/design-schema'
import { buildDesignCommitResponse, getNextDesignVersion } from './design/commit.post'
import { parsePreviewInstruction } from './design/preview.post'

describe('design api helpers', () => {
  it('calculates the next persisted design version', () => {
    expect(getNextDesignVersion(undefined)).toBe(1)
    expect(getNextDesignVersion({ version: 4 })).toBe(5)
  })

  it('validates preview instructions', () => {
    expect(parsePreviewInstruction({ instruction: '让页面更像星空' })).toBe('让页面更像星空')
    expect(() => parsePreviewInstruction({ instruction: '' })).toThrow()
  })

  it('builds commit response', () => {
    expect(buildDesignCommitResponse(2)).toEqual({ ok: true, version: 2 })
  })

  it('keeps default schema parseable for GET fallback', () => {
    expect(createDefaultDesignSchema().sections.length).toBeGreaterThan(0)
  })
})
