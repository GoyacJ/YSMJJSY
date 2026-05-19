import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { createGeneratedContentDisclosure, type GeneratedContentDisclosureInput } from './design-schema'

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/)

  if (!match) {
    throw new Error('Invalid data url')
  }

  return {
    mimeType: match[1],
    data: Buffer.from(match[2], 'base64'),
  }
}

function resolveSafePath(root: string, relativePath: string) {
  const resolvedRoot = resolve(root)
  const normalized = normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '')
  const absolutePath = resolve(join(resolvedRoot, normalized))

  if (!absolutePath.startsWith(`${resolvedRoot}/`) && absolutePath !== resolvedRoot) {
    throw new Error('Invalid blob path')
  }

  return absolutePath
}

export function writeBlobDataUrl(input: {
  root: string
  keyId: string
  id: string
  dataUrl: string
  disclosure?: GeneratedContentDisclosureInput
}) {
  const parsed = parseDataUrl(input.dataUrl)
  const relativePath = `${input.keyId}/${input.id}`
  const absolutePath = resolveSafePath(input.root, relativePath)

  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, parsed.data)

  return {
    relativePath,
    absolutePath,
    mimeType: parsed.mimeType,
    ...(input.disclosure ? { disclosure: createGeneratedContentDisclosure(input.disclosure) } : {}),
  }
}

export function readBlobDataUrl(input: {
  root: string
  relativePath: string
  mimeType: string
}) {
  const absolutePath = resolveSafePath(input.root, input.relativePath)
  const data = readFileSync(absolutePath)

  return `data:${input.mimeType};base64,${data.toString('base64')}`
}

export function readBlobFile(input: {
  root: string
  relativePath: string
}) {
  const absolutePath = resolveSafePath(input.root, input.relativePath)

  return readFileSync(absolutePath)
}
