import { describe, expect, it } from 'vitest'
import { createDefaultDesignSchema, createGeneratedContentDisclosure, parseDesignSchema } from './design-schema'

describe('design schema', () => {
  it('validates the default schema', () => {
    expect(parseDesignSchema(createDefaultDesignSchema()).version).toBe(1)
  })

  it('rejects unknown section types', () => {
    expect(() => parseDesignSchema({
      ...createDefaultDesignSchema(),
      sections: [{ type: 'html', text: '<script />' }],
    })).toThrow()
  })

  it('rejects oversized titles', () => {
    expect(() => parseDesignSchema({
      ...createDefaultDesignSchema(),
      title: 'x'.repeat(81),
    })).toThrow()
  })

  it('creates generated content disclosure metadata', () => {
    expect(createGeneratedContentDisclosure({
      provider: 'minimax',
      generatedAt: '2026-05-19T00:00:00.000Z',
      sourceWorkId: 'work_1',
    })).toEqual({
      aiGenerated: true,
      explicitLabel: 'AI 生成',
      provider: 'minimax',
      generatedAt: '2026-05-19T00:00:00.000Z',
      sourceWorkId: 'work_1',
    })
  })
})
