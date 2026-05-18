import { createError, defineEventHandler, getRouterParam } from 'h3'
import {
  addApprovalEvent,
  buildAgentInboxActionRouteInput,
  parseInboxItemId,
  type InboxActionInput,
} from './approve.post'
import { applyAgentProposalAction } from '../../../../agent/proposals/[id].put'

export function rejectAgentInboxItem(input: InboxActionInput) {
  const parsed = parseInboxItemId(input.itemId)

  if (parsed.type === 'proposal') {
    const result = applyAgentProposalAction({
      keyId: input.keyId,
      proposalId: parsed.id,
      action: 'reject',
      now: input.now,
      profile: input.profile,
      agentState: input.agentState,
      proposals: input.proposals,
      snapshots: input.snapshots,
      states: input.states,
      memories: input.memories,
    })

    if (!result) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Inbox item not found',
      })
    }

    addApprovalEvent(input, parsed, false)

    return {
      id: result.id,
      type: parsed.type,
      status: result.status,
    }
  }

  addApprovalEvent(input, parsed, false)

  return {
    id: parsed.id,
    type: parsed.type,
    status: 'rejected',
  }
}

export default defineEventHandler((event) => {
  const itemId = getRouterParam(event, 'id')

  if (!itemId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing inbox item id',
    })
  }

  return rejectAgentInboxItem(buildAgentInboxActionRouteInput(event, itemId))
})
