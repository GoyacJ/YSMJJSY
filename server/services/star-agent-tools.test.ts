import { describe, expect, it, vi } from 'vitest'
import { createAgentToolRegistry } from './agent-runtime'
import { registerStarAgentTools } from './star-agent-tools'

describe('star agent tools', () => {
  it('registers star domain tools with risk metadata', () => {
    const registry = createAgentToolRegistry()

    registerStarAgentTools(registry, {} as any)

    expect(registry.list().map(tool => tool.name)).toEqual(expect.arrayContaining([
      'star.previewDesign',
      'star.publishWork',
      'star.governMemory',
      'star.generateImage',
      'star.generateMusic',
      'star.generateVideo',
    ]))
    expect(registry.get('star.publishWork')?.approvalRequired).toBe(true)
  })

  it('executes publish work through injected repositories', async () => {
    const registry = createAgentToolRegistry()
    const updateWorkVisibility = vi.fn()

    registerStarAgentTools(registry, {
      keyId: 'key_1',
      now: '2026-05-18T00:00:00.000Z',
      works: {
        getWorkByKey: () => ({ id: 'work_1', visibility: 'private' }),
        updateWorkVisibility,
      },
    } as any)

    await registry.execute('star.publishWork', { workId: 'work_1' })

    expect(updateWorkVisibility).toHaveBeenCalledWith('key_1', 'work_1', 'public', '2026-05-18T00:00:00.000Z')
  })
})
