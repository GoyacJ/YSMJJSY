import { nanoid } from 'nanoid'
import type { AgentEventRecord, AgentObservationRecord, AgentWorkRecord, KeyDesignRecord } from '../db/sqlite'
import type { StarPageDesignSchema } from '../../types/design-schema'
import { buildAgentEvent } from './agent-events'
import { attachGeneratedContentDisclosure } from './design-schema'

export function getNextDesignVersion(latest: Pick<KeyDesignRecord, 'version'> | undefined) {
  return latest ? latest.version + 1 : 1
}

export function buildWorkFromCommittedDesign(input: {
  keyId: string
  version: number
  schema: StarPageDesignSchema
  prompt: string
  now: string
}): AgentWorkRecord {
  return {
    id: nanoid(),
    keyId: input.keyId,
    type: 'page_design',
    title: input.schema.title || `页面设计 v${input.version}`,
    summary: input.prompt || '保存了一版页面设计。',
    sourceConversationId: null,
    sourceMediaTaskId: null,
    sourceDesignVersion: input.version,
    previewUrl: null,
    payloadJson: JSON.stringify(attachGeneratedContentDisclosure(input.schema, {
      generatedAt: input.now,
    })),
    visibility: 'private',
    createdAt: input.now,
    updatedAt: input.now,
  }
}

export function recordDesignObservation(input: {
  agentId: string
  version: number
  prompt: string
  now: string
  observations: { addObservation: (record: AgentObservationRecord) => void }
  events: { addEvent: (record: AgentEventRecord) => void }
}) {
  const observationId = `observation_${nanoid()}`

  input.observations.addObservation({
    id: observationId,
    agentId: input.agentId,
    sourceType: 'design',
    sourceId: `design:${input.version}`,
    summary: input.prompt || `保存页面设计 v${input.version}。`,
    payloadJson: JSON.stringify({ version: input.version }),
    createdAt: input.now,
  })
  input.events.addEvent(buildAgentEvent({
    id: `event_${nanoid()}`,
    agentId: input.agentId,
    type: 'observation.created',
    title: '观察记录',
    summary: '页面设计变更已记录。',
    targetType: 'observation',
    targetId: observationId,
    payload: { sourceType: 'design', version: input.version },
    createdAt: input.now,
  }))
}

export function commitKeyDesign(input: {
  keyId: string
  schema: StarPageDesignSchema
  prompt: string
  now: string
  designs: {
    getLatestDesign: (keyId: string) => Pick<KeyDesignRecord, 'version'> | undefined
    addKeyDesign: (record: { keyId: string, version: number, schemaJson: string, prompt: string, createdAt: string }) => void
  }
  works: {
    addWork: (record: AgentWorkRecord) => void
  }
  markActivity?: (keyId: string, kind: 'design') => void
  observation?: {
    agentId: string
    observations: { addObservation: (record: AgentObservationRecord) => void }
    events: { addEvent: (record: AgentEventRecord) => void }
  }
}) {
  const version = getNextDesignVersion(input.designs.getLatestDesign(input.keyId))

  input.designs.addKeyDesign({
    keyId: input.keyId,
    version,
    schemaJson: JSON.stringify(input.schema),
    prompt: input.prompt,
    createdAt: input.now,
  })
  const work = buildWorkFromCommittedDesign({
    keyId: input.keyId,
    version,
    schema: input.schema,
    prompt: input.prompt,
    now: input.now,
  })
  input.works.addWork(work)
  input.markActivity?.(input.keyId, 'design')
  if (input.observation) {
    recordDesignObservation({
      agentId: input.observation.agentId,
      version,
      prompt: input.prompt,
      now: input.now,
      observations: input.observation.observations,
      events: input.observation.events,
    })
  }

  return {
    ok: true,
    version,
    workId: work.id,
  }
}
