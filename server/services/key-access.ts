import { createHmac } from 'node:crypto'

export function normalizeKey(input: string) {
  const normalized = input.trim()

  if (normalized.length < 3 || normalized.length > 64) {
    throw new Error('Invalid key length')
  }

  if (/[\x00-\x1F\x7F]/.test(normalized)) {
    throw new Error('Invalid key characters')
  }

  return normalized
}

export function createKeyLookupHash(key: string, secret: string) {
  return createHmac('sha256', secret || 'dev-secret')
    .update(normalizeKey(key))
    .digest('hex')
}

export function createIpHash(ip: string | undefined, secret: string) {
  return createHmac('sha256', secret || 'dev-secret')
    .update(ip || 'unknown')
    .digest('hex')
}
