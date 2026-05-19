import type { AgentToolRegistry } from './agent-runtime'
import type { StarChatToolCall, StarChatTurnPlan } from './star-chat-planner'

export type NormalizedStarChatToolCall = {
  toolName: string
  input: Record<string, unknown>
  mode: StarChatToolCall['mode']
  evidence: string
  reason: string
  status: 'ready' | 'rejected'
  error?: string
}

const mediaToolNames = new Set([
  'star.generateImage',
  'star.generateMusic',
  'star.generateVideo',
])

function rejectCall(call: StarChatToolCall, error: string): NormalizedStarChatToolCall {
  return {
    toolName: call.toolName,
    input: call.input,
    mode: call.mode,
    evidence: call.evidence,
    reason: call.reason,
    status: 'rejected',
    error,
  }
}

function hasPrompt(input: Record<string, unknown>) {
  return typeof input.prompt === 'string' && Boolean(input.prompt.trim())
}

function normalizeInput(call: StarChatToolCall, reply: string) {
  if (call.toolName !== 'star.speakReply') {
    return call.input
  }

  return {
    ...call.input,
    text: call.input.text === '$reply' ? reply : call.input.text,
  }
}

export function normalizeStarChatToolCalls(input: {
  plan: StarChatTurnPlan
  registry: Pick<AgentToolRegistry, 'get'>
  reply: string
}): NormalizedStarChatToolCall[] {
  return input.plan.toolCalls.slice(0, 4).map((call) => {
    if (!input.registry.get(call.toolName)) {
      return rejectCall(call, 'Unknown tool')
    }

    const normalizedInput = normalizeInput(call, input.reply)

    if (mediaToolNames.has(call.toolName) && !hasPrompt(normalizedInput)) {
      return rejectCall({ ...call, input: normalizedInput }, 'Missing prompt')
    }

    return {
      toolName: call.toolName,
      input: normalizedInput,
      mode: call.mode,
      evidence: call.evidence,
      reason: call.reason,
      status: 'ready',
    }
  })
}
