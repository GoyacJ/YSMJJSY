import { describe, expect, it } from 'vitest'
import { create520StarPoints } from './star-map'

describe('create520StarPoints', () => {
  it('creates deterministic points inside bounds', () => {
    const points = create520StarPoints({ width: 800, height: 600 })
    const nextPoints = create520StarPoints({ width: 800, height: 600 })

    expect(points).toEqual(nextPoints)
    expect(points.length).toBeGreaterThan(20)
    expect(points.every(point => point.x >= 0 && point.x <= 800)).toBe(true)
    expect(points.every(point => point.y >= 0 && point.y <= 600)).toBe(true)
  })
})
