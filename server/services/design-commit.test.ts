import { describe, expect, it, vi } from 'vitest'
import { createDefaultDesignSchema } from './design-schema'
import { commitKeyDesign } from './design-commit'

describe('design commit service', () => {
  it('persists a design version and private work through one shared service', () => {
    const addKeyDesign = vi.fn()
    const addWork = vi.fn()
    const markActivity = vi.fn()
    const schema = createDefaultDesignSchema()

    const result = commitKeyDesign({
      keyId: 'key_1',
      schema,
      prompt: '更像星空',
      now: '2026-05-19T00:00:00.000Z',
      designs: {
        getLatestDesign: () => ({ version: 2 }),
        addKeyDesign,
      },
      works: { addWork },
      markActivity,
    })

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      version: 3,
    }))
    expect(addKeyDesign).toHaveBeenCalledWith(expect.objectContaining({
      keyId: 'key_1',
      version: 3,
      schemaJson: JSON.stringify(schema),
    }))
    expect(addWork).toHaveBeenCalledWith(expect.objectContaining({
      keyId: 'key_1',
      type: 'page_design',
      sourceDesignVersion: 3,
      visibility: 'private',
    }))
    expect(JSON.parse(addWork.mock.calls[0][0].payloadJson)).toMatchObject({
      title: schema.title,
      disclosure: {
        aiGenerated: true,
        explicitLabel: 'AI 生成',
        generatedAt: '2026-05-19T00:00:00.000Z',
      },
    })
    expect(markActivity).toHaveBeenCalledWith('key_1', 'design')
  })
})
