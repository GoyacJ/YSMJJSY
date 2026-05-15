import { describe, expect, it } from 'vitest'
import { assertWithinLimit, usageLimits } from './rate-limit'

describe('rate limits', () => {
  it('allows requests below the configured limit', () => {
    expect(assertWithinLimit({ current: 0, max: 5 })).toBe(true)
  })

  it('rejects requests at the configured limit', () => {
    expect(assertWithinLimit({ current: 5, max: 5 })).toBe(false)
  })

  it('exports public abuse-control limits', () => {
    expect(usageLimits.createPerIpPerDay).toBe(5)
    expect(usageLimits.chatPerKeyPerDay).toBe(80)
  })
})
