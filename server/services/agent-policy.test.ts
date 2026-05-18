import { describe, expect, it } from 'vitest'
import { defaultAgentPolicy, evaluateAgentToolPolicy } from './agent-policy'

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
})
