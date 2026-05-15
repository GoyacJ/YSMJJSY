import { describe, expect, it } from 'vitest'
import { createDefaultDesignSchema, parseDesignSchema } from './design-schema'

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
})
