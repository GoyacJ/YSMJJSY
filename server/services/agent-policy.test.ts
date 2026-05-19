import { describe, expect, it } from 'vitest'
import { defaultStarBoundarySettings } from '../db/sqlite'
import { createAgentPolicyFromBoundarySettings, defaultAgentPolicy, evaluateAgentToolPolicy } from './agent-policy'

describe('agent policy', () => {
  it('allows low risk tools without approval', () => {
    expect(evaluateAgentToolPolicy(defaultAgentPolicy, {
      name: 'star.readContext',
      riskLevel: 'low',
      approvalRequired: false,
    })).toEqual({ allowed: true, approvalRequired: false })
  })

  it('requires approval for publishing', () => {
    expect(evaluateAgentToolPolicy(defaultAgentPolicy, {
      name: 'star.publishWork',
      riskLevel: 'high',
      approvalRequired: true,
    })).toEqual({ allowed: true, approvalRequired: true })
  })

  it('maps boundary settings into policy flags', () => {
    expect(createAgentPolicyFromBoundarySettings({
      ...defaultStarBoundarySettings,
      requireApprovalForPublishing: true,
      requireApprovalForPersonaChange: true,
      requireApprovalForSensitiveMemory: true,
      minorMode: true,
      disallowedMemoryTopics: ['身份证号'],
      allowedMemoryTopics: ['写作偏好'],
    })).toMatchObject({
      requireApprovalForPublishing: true,
      requireApprovalForPersonaChange: true,
      requireApprovalForSensitiveMemory: true,
      minorMode: true,
      disallowedMemoryTopics: ['身份证号'],
      allowedMemoryTopics: ['写作偏好'],
    })
  })

  it('requires approval for sensitive memory writes by default', () => {
    expect(evaluateAgentToolPolicy(defaultAgentPolicy, {
      name: 'star.writeMemory',
      riskLevel: 'medium',
      approvalRequired: false,
    }, {
      sensitive: true,
      content: '用户的身份证号。',
    })).toEqual({ allowed: true, approvalRequired: true })
  })

  it('rejects memory writes matching disallowed topics', () => {
    const policy = createAgentPolicyFromBoundarySettings({
      ...defaultStarBoundarySettings,
      disallowedMemoryTopics: ['身份证号'],
    })

    expect(evaluateAgentToolPolicy(policy, {
      name: 'star.writeMemory',
      riskLevel: 'medium',
      approvalRequired: false,
    }, {
      content: '用户身份证号是 110000。',
    })).toMatchObject({
      allowed: false,
    })
  })

  it('rejects intimate relationship persona changes in minor mode', () => {
    const policy = createAgentPolicyFromBoundarySettings({
      ...defaultStarBoundarySettings,
      minorMode: true,
    })

    expect(evaluateAgentToolPolicy(policy, {
      name: 'star.applyPersonaChange',
      riskLevel: 'high',
      approvalRequired: false,
    }, {
      relationshipRole: '虚拟恋人',
    })).toMatchObject({
      allowed: false,
    })
  })
})
