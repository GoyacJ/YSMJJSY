import { describe, expect, it } from 'vitest'
import { createFlyingBirdEntities, createPublicStarEntities, findChangedActivityIds, resolveSceneMode } from './public-star-scene'

describe('public star scene utilities', () => {
  it('creates stable entities for public stars', () => {
    const entities = createPublicStarEntities([
      {
        id: 'key_1',
        name: '阿月',
        mbti: 'INTJ',
        createdAt: '2026-05-16T00:00:00.000Z',
        activityAt: '2026-05-16T00:01:00.000Z',
        activityKind: 'created',
      },
    ], { width: 1000, height: 700 })

    expect(entities[0]).toMatchObject({
      id: 'key_1',
      label: '阿月',
      activityKind: 'created',
    })
    expect(entities[0]?.x).toBeGreaterThanOrEqual(0)
    expect(entities[0]?.x).toBeLessThanOrEqual(1000)
    expect(entities[0]?.y).toBeGreaterThanOrEqual(0)
    expect(entities[0]?.y).toBeLessThanOrEqual(700)
  })

  it('resolves light and dark scene modes', () => {
    expect(resolveSceneMode(false)).toBe('sky')
    expect(resolveSceneMode(true)).toBe('galaxy')
  })

  it('spreads entities across the visible sky bands', () => {
    const entities = createPublicStarEntities(Array.from({ length: 24 }, (_, index) => ({
      id: `key_${index}`,
      name: `称呼${index}`,
      mbti: 'INTJ',
      createdAt: '2026-05-16T00:00:00.000Z',
    })), { width: 1000, height: 700 })

    expect(entities.some(entity => entity.y < 120)).toBe(true)
    expect(entities.some(entity => entity.y > 360 && entity.y < 448)).toBe(true)
    expect(entities.some(entity => entity.x < 160)).toBe(true)
    expect(entities.some(entity => entity.x > 840)).toBe(true)
    expect(entities.every(entity => entity.y <= 448)).toBe(true)
    expect(entities.some(entity =>
      entity.x > 350 && entity.x < 650 && entity.y > 170 && entity.y < 390,
    )).toBe(true)
  })

  it('moves sky birds across the screen over time', () => {
    const stars = [{
      id: 'key_1',
      name: '月光',
      mbti: 'INTJ',
      createdAt: '2026-05-16T00:00:00.000Z',
    }]
    const first = createFlyingBirdEntities(stars, { width: 1000, height: 700 }, 0)[0]
    const second = createFlyingBirdEntities(stars, { width: 1000, height: 700 }, 1000)[0]

    expect(first?.x).not.toBe(second?.x)
    expect(first?.x).toBeGreaterThanOrEqual(-150)
    expect(first?.x).toBeLessThanOrEqual(1150)
    expect(second?.x).toBeGreaterThanOrEqual(-150)
    expect(second?.x).toBeLessThanOrEqual(1150)
  })

  it('finds stars with changed activity', () => {
    expect(findChangedActivityIds(
      [{ id: 'key_1', name: '阿月', mbti: 'INTJ', createdAt: 't0', activityAt: 't1' }],
      [{ id: 'key_1', name: '阿月', mbti: 'INTJ', createdAt: 't0', activityAt: 't2' }],
    )).toEqual(['key_1'])
  })
})
