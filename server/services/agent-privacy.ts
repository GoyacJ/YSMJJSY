const sensitiveResponseKeys = new Set([
  'keyLookupHash',
  'createdIpHash',
  'payloadJson',
  'rawJson',
  'rawProviderBody',
])

function isSensitiveKey(key: string) {
  return sensitiveResponseKeys.has(key) || key.toLowerCase().includes('session')
}

function isInlineMedia(value: string) {
  return value.startsWith('data:image') || value.startsWith('data:audio')
}

export function sanitizeAgentResponseValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeAgentResponseValue(item))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !isSensitiveKey(key))
        .map(([key, item]) => [key, sanitizeAgentResponseValue(item)]),
    )
  }

  if (typeof value === 'string' && isInlineMedia(value)) {
    return '[redacted]'
  }

  return value
}
