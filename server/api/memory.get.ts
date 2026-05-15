import { createMemoryRepository } from '../db/sqlite'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const repo = createMemoryRepository(config.sqlitePath)

  return {
    memories: repo.listMemories(),
  }
})
