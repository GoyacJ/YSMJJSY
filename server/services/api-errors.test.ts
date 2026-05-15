import { describe, expect, it } from 'vitest'
import { withMiniMaxErrorBoundary } from './api-errors'
import { MiniMaxError } from './minimax'

describe('api errors', () => {
  it('hides upstream MiniMax response bodies', async () => {
    await expect(withMiniMaxErrorBoundary(async () => {
      throw new MiniMaxError('MiniMax request failed', 500, 'upstream secret body')
    })).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: 'MiniMax request failed',
    })
  })
})
