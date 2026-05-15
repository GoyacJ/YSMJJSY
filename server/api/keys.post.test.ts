import { describe, expect, it } from 'vitest'
import {
  buildCreatedKeyResponse,
  createDefaultDesignSchemaJson,
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
})
