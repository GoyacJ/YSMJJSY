import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readBlobDataUrl, writeBlobDataUrl } from './blob-storage'

describe('blob storage', () => {
  it('stores data urls as local files and reads them back', () => {
    const root = mkdtempSync(join(tmpdir(), 'ysmjjsy-blob-'))
    const result = writeBlobDataUrl({
      root,
      keyId: 'key_1',
      id: 'att_1',
      dataUrl: 'data:image/png;base64,YWJj',
    })

    expect(result.relativePath).toBe('key_1/att_1')
    expect(readFileSync(result.absolutePath, 'utf8')).toBe('abc')
    expect(readBlobDataUrl({
      root,
      relativePath: result.relativePath,
      mimeType: 'image/png',
    })).toBe('data:image/png;base64,YWJj')
  })

  it('returns disclosure metadata for generated blobs', () => {
    const root = mkdtempSync(join(tmpdir(), 'ysmjjsy-blob-'))
    const result = writeBlobDataUrl({
      root,
      keyId: 'key_1',
      id: 'att_1',
      dataUrl: 'data:image/png;base64,YWJj',
      disclosure: {
        provider: 'minimax',
        generatedAt: '2026-05-19T00:00:00.000Z',
      },
    })

    expect(result.disclosure).toEqual({
      aiGenerated: true,
      explicitLabel: 'AI 生成',
      provider: 'minimax',
      generatedAt: '2026-05-19T00:00:00.000Z',
    })
  })
})
