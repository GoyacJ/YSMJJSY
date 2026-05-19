import type { AgentToolDefinition, AgentToolRiskLevel } from './agent-runtime'
import type { StarBoundarySettings } from '../db/sqlite'

export type AgentPolicy = {
  autoLearn: boolean
  autoReflect: boolean
  autoRunLowRiskTasks: boolean
  requireApprovalForPersonaChange: boolean
  requireApprovalForDesignChange: boolean
  requireApprovalForPublishing: boolean
  requireApprovalForMemoryRejection: boolean
  requireApprovalForSensitiveMemory: boolean
  disallowedMemoryTopics: string[]
  allowedMemoryTopics: string[]
  minorMode: boolean
}

export type AgentPolicyDecision = {
  allowed: boolean
  approvalRequired: boolean
  reason?: string
}

export const defaultAgentPolicy: AgentPolicy = {
  autoLearn: true,
  autoReflect: true,
  autoRunLowRiskTasks: true,
  requireApprovalForPersonaChange: true,
  requireApprovalForDesignChange: true,
  requireApprovalForPublishing: true,
  requireApprovalForMemoryRejection: true,
  requireApprovalForSensitiveMemory: true,
  disallowedMemoryTopics: [],
  allowedMemoryTopics: [],
  minorMode: false,
}

export function createAgentPolicyFromBoundarySettings(boundarySettings: StarBoundarySettings): AgentPolicy {
  return {
    ...defaultAgentPolicy,
    requireApprovalForPublishing: boundarySettings.requireApprovalForPublishing,
    requireApprovalForPersonaChange: boundarySettings.requireApprovalForPersonaChange,
    requireApprovalForSensitiveMemory: boundarySettings.requireApprovalForSensitiveMemory,
    disallowedMemoryTopics: boundarySettings.disallowedMemoryTopics,
    allowedMemoryTopics: boundarySettings.allowedMemoryTopics,
    minorMode: boundarySettings.minorMode,
  }
}

function readStringInput(input: unknown, fields: string[]) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return ''
  }

  return fields
    .map(field => (input as Record<string, unknown>)[field])
    .filter(value => typeof value === 'string')
    .join('\n')
}

function isSensitiveMemoryInput(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return false
  }

  return (input as Record<string, unknown>).sensitive === true
}

function isMemoryWriteTool(name: string) {
  return name === 'star.writeMemory' || name === 'star.rememberMemory'
}

function isPersonaChangeTool(name: string) {
  return name === 'star.applyPersonaChange' || name === 'star.proposePersonaChange'
}

function isIntimatePersonaInput(input: unknown) {
  const text = readStringInput(input, ['relationshipRole', 'role', 'tone', 'summary'])
  return /恋人|伴侣|爱人|暧昧|亲密关系|virtual lover/i.test(text)
}

function disallowedMemoryTopic(policy: AgentPolicy, input: unknown) {
  const text = readStringInput(input, ['content', 'summary', 'topic']).toLowerCase()

  return policy.disallowedMemoryTopics.find((topic) => {
    const normalized = topic.trim().toLowerCase()
    return normalized && text.includes(normalized)
  })
}

function requiresApprovalByName(policy: AgentPolicy, name: string, input?: unknown) {
  if (name === 'star.publishWork') {
    return policy.requireApprovalForPublishing
  }

  if (isPersonaChangeTool(name)) {
    return policy.requireApprovalForPersonaChange
  }

  if (isMemoryWriteTool(name) && isSensitiveMemoryInput(input)) {
    return policy.requireApprovalForSensitiveMemory
  }

  if (name === 'star.previewDesign' || name === 'star.commitDesign') {
    return policy.requireApprovalForDesignChange
  }

  if (name === 'star.governMemory') {
    return policy.requireApprovalForMemoryRejection
  }

  return false
}

function requiresApprovalByRisk(policy: AgentPolicy, riskLevel: AgentToolRiskLevel) {
  if (riskLevel === 'low') {
    return false
  }

  if (riskLevel === 'medium') {
    return !policy.autoRunLowRiskTasks
  }

  return true
}

export function evaluateAgentToolPolicy(
  policy: AgentPolicy,
  tool: Pick<AgentToolDefinition, 'name' | 'riskLevel' | 'approvalRequired'>,
  input?: unknown,
): AgentPolicyDecision {
  if (isMemoryWriteTool(tool.name)) {
    const topic = disallowedMemoryTopic(policy, input)

    if (topic) {
      return {
        allowed: false,
        approvalRequired: false,
        reason: `不允许记住：${topic}`,
      }
    }
  }

  if (policy.minorMode && isPersonaChangeTool(tool.name) && isIntimatePersonaInput(input)) {
    return {
      allowed: false,
      approvalRequired: false,
      reason: '未成年人模式不允许亲密关系定位。',
    }
  }

  return {
    allowed: true,
    approvalRequired:
      tool.approvalRequired
      || requiresApprovalByName(policy, tool.name, input)
      || requiresApprovalByRisk(policy, tool.riskLevel),
  }
}
