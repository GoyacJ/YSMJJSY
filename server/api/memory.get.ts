import { createMemoryRepository } from '../db/sqlite'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const keyId = event.context.keyId
  const repo = createMemoryRepository(config.sqlitePath)

  return {
    memories: keyId ? repo.listMemoriesByKey(keyId) : [],
  }
})
