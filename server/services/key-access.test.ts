import { describe, expect, it } from 'vitest'
import { createIpHash, createKeyLookupHash, normalizeKey } from './key-access'

describe('key access', () => {
  it('normalizes valid keys', () => {
    expect(normalizeKey('  abc  ')).toBe('abc')
  })

  it('rejects invalid keys', () => {
    expect(() => normalizeKey('')).toThrow()
    expect(() => normalizeKey('ab')).toThrow()
    expect(() => normalizeKey(`abc${String.fromCharCode(0)}`)).toThrow()
  })

  it('creates deterministic lookup hashes without storing the key', () => {
    expect(createKeyLookupHash('abc', 'secret')).toBe(createKeyLookupHash(' abc ', 'secret'))
    expect(createKeyLookupHash('abc', 'secret')).not.toBe('abc')
  })

  it('creates deterministic IP hashes without storing the IP', () => {
    expect(createIpHash('127.0.0.1', 'secret')).toBe(createIpHash('127.0.0.1', 'secret'))
    expect(createIpHash('127.0.0.1', 'secret')).not.toContain('127.0.0.1')
  })
})
