import { describe, expect, it } from 'vitest'
import { buildAgentTaskInputFromIntent } from './agent-task-intents'

describe('agent task intents', () => {
  it('maps generate image tasks to star.generateImage tool input', () => {
    expect(buildAgentTaskInputFromIntent({
      type: 'generate_artifact',
      input: { artifactType: 'image', prompt: '月光森林' },
    })).toEqual({
      toolName: 'star.generateImage',
      input: { prompt: '月光森林' },
    })
  })

  it('maps publish artifact tasks to star.publishWork tool input', () => {
    expect(buildAgentTaskInputFromIntent({
      type: 'publish_artifact',
      input: { workId: 'work_1' },
    })).toEqual({
      toolName: 'star.publishWork',
      input: { workId: 'work_1' },
    })
  })
})
