import { defineEventHandler } from 'h3'
import { withMiniMaxErrorBoundary } from '../../services/api-errors'
import { createMiniMaxClient } from '../../services/minimax'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const client = createMiniMaxClient({
    apiKey: config.minimaxApiKey,
    groupId: config.minimaxGroupId,
  })

  return withMiniMaxErrorBoundary(() => client.getTokenPlanRemains(), 'MiniMax quota query failed')
})
