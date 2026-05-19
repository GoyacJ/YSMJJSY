import type { AgentCore, AgentCoreProposal } from '../composables/useAgentCore'

type PlanetPosition = {
  x: number
  y: number
}

export type MemoryPlanetState = {
  memoryStars: Array<{
    id: string
    label: string
    content: string
    type: string
    importance: number
    confidence: number
    status?: string
    sourceConversationId?: string | null
    latestGovernanceEvent?: {
      id: string
      action: string
      reason: string
      createdAt: string
    }
    bright: boolean
    position: PlanetPosition
  }>
  reflectionNebulas: Array<{
    id: string
    summary: string
    position: PlanetPosition
  }>
  proposalLights: Array<{
    id: string
    type: string
    title: string
    summary: string
    status: 'pending'
    position: PlanetPosition
  }>
  orbitRings: Array<{
    id: string
    type: string
    title: string
    summary: string
    status: 'accepted' | 'applied'
  }>
}

function hashId(id: string) {
  return Array.from(id).reduce((hash, character) => hash + character.charCodeAt(0), 0)
}

function clampPosition(value: number) {
  return Math.min(86, Math.max(14, value))
}

function buildPosition(id: string, index: number, radiusOffset = 0): PlanetPosition {
  const hash = hashId(id)
  const angle = ((index * 137 + hash) % 360) * (Math.PI / 180)
  const radius = 28 + ((hash + index * 17 + radiusOffset) % 24)

  return {
    x: Math.round(clampPosition(50 + Math.cos(angle) * radius) * 100) / 100,
    y: Math.round(clampPosition(50 + Math.sin(angle) * radius) * 100) / 100,
  }
}

function buildProposalRing(proposal: AgentCoreProposal) {
  if (proposal.status !== 'accepted' && proposal.status !== 'applied') {
    return null
  }

  return {
    id: proposal.id,
    type: proposal.type,
    title: proposal.title,
    summary: proposal.summary,
    status: proposal.status,
  }
}

export function buildMemoryPlanetState(core: AgentCore | null): MemoryPlanetState {
  if (!core) {
    return {
      memoryStars: [],
      reflectionNebulas: [],
      proposalLights: [],
      orbitRings: [],
    }
  }

  return {
    memoryStars: core.memories.map((memory, index) => ({
      id: memory.id,
      label: memory.content,
      content: memory.content,
      type: memory.type,
      importance: memory.importance,
      confidence: memory.confidence,
      status: memory.status,
      sourceConversationId: memory.sourceConversationId,
      latestGovernanceEvent: memory.governanceEvents?.[0],
      bright: memory.importance >= 0.8,
      position: buildPosition(memory.id, index),
    })),
    reflectionNebulas: core.latestReflections.map((reflection, index) => ({
      id: reflection.id,
      summary: reflection.summary,
      position: buildPosition(reflection.id, index, 9),
    })),
    proposalLights: core.proposals.pending.map((proposal, index) => ({
      id: proposal.id,
      type: proposal.type,
      title: proposal.title,
      summary: proposal.summary,
      status: 'pending',
      position: buildPosition(proposal.id, index, 18),
    })),
    orbitRings: core.proposals.history
      .map(buildProposalRing)
      .filter((ring): ring is NonNullable<typeof ring> => Boolean(ring)),
  }
}
