import type { AgentToolDefinition, AgentToolRiskLevel } from './agent-runtime'

export type AgentPolicy = {
  autoLearn: boolean
  autoReflect: boolean
  autoRunLowRiskTasks: boolean
  requireApprovalForPersonaChange: boolean
  requireApprovalForDesignChange: boolean
  requireApprovalForPublishing: boolean
  requireApprovalForMemoryRejection: boolean
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
}

function requiresApprovalByName(policy: AgentPolicy, name: string) {
  if (name === 'star.publishWork') {
    return policy.requireApprovalForPublishing
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
): AgentPolicyDecision {
  return {
    allowed: true,
    approvalRequired:
      tool.approvalRequired
      || requiresApprovalByName(policy, tool.name)
      || requiresApprovalByRisk(policy, tool.riskLevel),
  }
}
