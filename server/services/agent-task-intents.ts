import { createError } from 'h3'
import type { AgentTaskType } from '../db/sqlite'

function readString(input: Record<string, unknown>, key: string) {
  const value = input[key]

  if (typeof value !== 'string' || !value.trim()) {
    throw createError({ statusCode: 400, statusMessage: `Missing ${key}` })
  }

  return value.trim()
}

export function buildAgentTaskInputFromIntent(input: {
  type: AgentTaskType
  input: Record<string, unknown>
}) {
  if (input.type === 'generate_artifact') {
    const artifactType = readString(input.input, 'artifactType')
    const prompt = readString(input.input, 'prompt')

    if (artifactType === 'image') return { toolName: 'star.generateImage', input: { prompt } }
    if (artifactType === 'music') return { toolName: 'star.generateMusic', input: { prompt } }
    if (artifactType === 'video') return { toolName: 'star.generateVideo', input: { prompt } }

    throw createError({ statusCode: 400, statusMessage: 'Unsupported artifact type' })
  }

  if (input.type === 'publish_artifact') {
    return {
      toolName: 'star.publishWork',
      input: { workId: readString(input.input, 'workId') },
    }
  }

  if (input.type === 'govern_memory') {
    return {
      toolName: 'star.governMemory',
      input: {
        memoryId: readString(input.input, 'memoryId'),
        action: readString(input.input, 'action'),
        reason: typeof input.input.reason === 'string' ? input.input.reason : '',
      },
    }
  }

  if (input.type === 'preview_design') {
    return {
      toolName: 'star.previewDesign',
      input: input.input,
    }
  }

  return input.input.toolName ? input.input : { toolName: 'star.noop', input: input.input }
}
