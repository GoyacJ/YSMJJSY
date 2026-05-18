import { describe, expect, it, vi } from 'vitest'
import { normalizeMediaPrompt, toVideoTaskStatus } from '../services/media'
import { generateMediaWithTool } from './image.post'

describe('media api helpers', () => {
  it('adds the visual style boundary to image prompts', () => {
    expect(normalizeMediaPrompt('画一张星空')).toContain('温柔')
  })

  it('maps provider video status', () => {
    expect(toVideoTaskStatus('Success')).toBe('succeeded')
    expect(toVideoTaskStatus('Fail')).toBe('failed')
  })

  it('generates media through star media tools', async () => {
    const execute = vi.fn(async () => ({ ok: true, output: { url: 'https://example.com/image.png' } }))

    const result = await generateMediaWithTool({
      toolName: 'star.generateImage',
      prompt: '星空',
      registry: { execute },
    } as any)

    expect(result).toEqual({ url: 'https://example.com/image.png' })
    expect(execute).toHaveBeenCalledWith('star.generateImage', { prompt: '星空' })
  })
})
