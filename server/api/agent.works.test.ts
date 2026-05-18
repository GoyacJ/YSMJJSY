import { describe, expect, it, vi } from 'vitest'
import { buildAgentWorksResponse } from './agent/works.get'
import { publishWorkWithTool, updateAgentWorkVisibilityAction } from './agent/works/[id].put'

describe('agent works api helpers', () => {
  it('returns only current key works', () => {
    const result = buildAgentWorksResponse({
      keyId: 'key_1',
      works: {
        listWorksByKey: () => [
          {
            id: 'work_1',
            keyId: 'key_1',
            type: 'image',
            title: '月光图',
            summary: '一张图。',
            sourceConversationId: 'c1',
            sourceDesignVersion: null,
            previewUrl: 'https://example.com/moon.png',
            payloadJson: '{"type":"image"}',
            visibility: 'private',
            createdAt: '2026-05-17T00:00:00.000Z',
            updatedAt: '2026-05-17T00:00:00.000Z',
          },
        ],
      },
    })

    expect(result.works).toHaveLength(1)
    expect(result.works[0]).toMatchObject({
      id: 'work_1',
      visibility: 'private',
      sourceConversationId: 'c1',
      sourceDesignVersion: null,
      payload: { type: 'image' },
    })
  })

  it('updates current key work visibility', () => {
    const updateWorkVisibility = vi.fn()

    const result = updateAgentWorkVisibilityAction({
      keyId: 'key_1',
      workId: 'work_1',
      visibility: 'public',
      now: '2026-05-17T00:00:00.000Z',
      works: {
        getWorkByKey: () => ({
          id: 'work_1',
          keyId: 'key_1',
          type: 'image',
          title: '月光图',
          summary: '一张图。',
          payloadJson: '{}',
          visibility: 'private',
          createdAt: '2026-05-17T00:00:00.000Z',
          updatedAt: '2026-05-17T00:00:00.000Z',
        }),
        updateWorkVisibility,
      },
    })

    expect(result.visibility).toBe('public')
    expect(updateWorkVisibility).toHaveBeenCalledWith('key_1', 'work_1', 'public', '2026-05-17T00:00:00.000Z')
  })

  it('publishes works through star.publishWork tool', async () => {
    const execute = vi.fn(async () => ({ ok: true, output: { id: 'work_1', visibility: 'public' } }))

    const result = await publishWorkWithTool({
      toolName: 'star.publishWork',
      workId: 'work_1',
      registry: { execute },
    } as any)

    expect(result.visibility).toBe('public')
    expect(execute).toHaveBeenCalledWith('star.publishWork', { workId: 'work_1' })
  })
})
