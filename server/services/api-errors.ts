import { createError } from 'h3'
import { MiniMaxError } from './minimax'

export async function withMiniMaxErrorBoundary<T>(
  operation: () => Promise<T>,
  statusMessage = 'MiniMax request failed',
) {
  try {
    return await operation()
  }
  catch (error) {
    if (error instanceof MiniMaxError) {
      throw createError({
        statusCode: 502,
        statusMessage,
      })
    }

    throw error
  }
}
