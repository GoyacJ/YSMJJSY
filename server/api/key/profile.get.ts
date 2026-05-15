import { createError, defineEventHandler } from 'h3'
import { createKeyProfileRepository } from '../../db/sqlite'

export default defineEventHandler((event) => {
  const keyId = event.context.keyId

  if (!keyId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const config = useRuntimeConfig(event)
  const profile = createKeyProfileRepository(config.sqlitePath).getKeyProfile(keyId)

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Profile not found',
    })
  }

  return {
    keyId: profile.id,
    assistantName: profile.assistantName,
    mbti: profile.mbti,
    configured: Boolean(profile.configuredAt),
  }
})
