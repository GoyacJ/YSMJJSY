import { describe, expect, it } from 'vitest'
import {
  buildCreatedKeyResponse,
  createDefaultDesignSchemaJson,
  defaultStarBoundarySettings,
  parseCreateKeyBody,
} from './keys.post'

describe('keys api helpers', () => {
  it('creates the initial needs-config response', () => {
    expect(buildCreatedKeyResponse('key_1')).toEqual({
      ok: true,
      keyId: 'key_1',
      needsConfig: true,
    })
  })

  it('creates a parseable default design schema', () => {
    const schema = JSON.parse(createDefaultDesignSchemaJson())

    expect(schema.version).toBe(1)
    expect(schema.sections.length).toBeGreaterThan(0)
  })

  it('requires new keys to be at least 6 characters', () => {
    expect(() => parseCreateKeyBody({ key: '12345' })).toThrow('Invalid key')
    expect(parseCreateKeyBody({ key: '123456' })).toEqual({
      key: '123456',
      boundarySettings: defaultStarBoundarySettings,
    })
  })

  it('uses conservative boundary defaults when no boundary input is provided', () => {
    expect(parseCreateKeyBody({ key: '123456' })).toEqual({
      key: '123456',
      boundarySettings: defaultStarBoundarySettings,
    })
  })

  it('accepts valid boundary input', () => {
    expect(parseCreateKeyBody({
      key: '123456',
      boundarySettings: {
        memoryWriteMode: 'manual',
        generatedWorksDefaultVisibility: 'private',
        requireApprovalForPublishing: true,
        requireApprovalForPersonaChange: true,
        requireApprovalForSensitiveMemory: true,
        disallowedMemoryTopics: ['身份证号'],
        allowedMemoryTopics: ['写作偏好'],
        minorMode: true,
      },
    }).boundarySettings).toMatchObject({
      memoryWriteMode: 'manual',
      disallowedMemoryTopics: ['身份证号'],
      allowedMemoryTopics: ['写作偏好'],
      minorMode: true,
    })
  })

  it('rejects invalid boundary memory write mode', () => {
    expect(() => parseCreateKeyBody({
      key: '123456',
      boundarySettings: {
        memoryWriteMode: 'always',
      },
    })).toThrow('Invalid key')
  })
})
