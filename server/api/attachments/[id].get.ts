import { Buffer } from 'node:buffer'
import { join } from 'node:path'
import { createError, defineEventHandler, getRouterParam, setResponseHeader } from 'h3'
import { createAttachmentRepository } from '../../db/sqlite'
import { readBlobFile } from '../../services/blob-storage'

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/)

  if (!match) {
    return null
  }

  return {
    mimeType: match[1],
    data: Buffer.from(match[2], 'base64'),
  }
}

export default defineEventHandler((event) => {
  const keyId = event.context.keyId
  const id = getRouterParam(event, 'id')

  if (!keyId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing attachment id' })
  }

  const config = useRuntimeConfig(event)
  const attachment = createAttachmentRepository(config.sqlitePath).getAttachmentByKey(keyId, id)

  if (!attachment) {
    throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
  }

  setResponseHeader(event, 'Content-Type', attachment.mimeType)
  setResponseHeader(event, 'Cache-Control', 'private, max-age=3600')

  if (attachment.dataUrl.startsWith('blob:')) {
    return readBlobFile({
      root: join(process.cwd(), 'data/uploads'),
      relativePath: attachment.dataUrl.slice('blob:'.length),
    })
  }

  const parsed = parseDataUrl(attachment.dataUrl)

  if (!parsed) {
    throw createError({ statusCode: 404, statusMessage: 'Attachment blob not found' })
  }

  return parsed.data
})
