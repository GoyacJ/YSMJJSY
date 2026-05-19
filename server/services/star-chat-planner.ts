import { z } from 'zod'

import type { AgentToolBehavior, AgentToolCategory } from './agent-runtime'

const fallbackPlan = {
  reply: '',
  toolSearches: [],
  toolCalls: [],
} as const

const recordSchema = z.record(z.string(), z.unknown())

const toolSearchSchema = z.object({
  query: z.string().trim().default(''),
  category: z.enum(['reply', 'media', 'memory', 'design', 'publish', 'system']).optional(),
  behavior: z.enum(['present_reply', 'create', 'retrieve', 'mutate', 'publish']).optional(),
  limit: z.number().int().positive().max(5).optional(),
})

const toolCallSchema = z.object({
  toolName: z.string().trim().min(1),
  input: recordSchema,
  mode: z.enum(['execute', 'propose']),
  evidence: z.string().trim().default(''),
  reason: z.string().trim().default(''),
})

export const starChatTurnPlanSchema = z.object({
  reply: z.string().trim().default(''),
  toolSearches: z.array(toolSearchSchema).max(2).default([]),
  toolCalls: z.array(toolCallSchema).max(4).default([]),
})

export type StarChatToolSearch = {
  query: string
  category?: AgentToolCategory
  behavior?: AgentToolBehavior
  limit?: number
}

export type StarChatToolCall = {
  toolName: string
  input: Record<string, unknown>
  mode: 'execute' | 'propose'
  evidence: string
  reason: string
}

export type StarChatTurnPlan = {
  reply: string
  toolSearches: StarChatToolSearch[]
  toolCalls: StarChatToolCall[]
}

function unwrapMarkdownJson(text: string) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)

  return fenced?.[1]?.trim() ?? trimmed
}

export function parseStarChatTurnPlan(text: string): StarChatTurnPlan {
  try {
    const parsed = JSON.parse(unwrapMarkdownJson(text))
    return starChatTurnPlanSchema.parse(parsed)
  }
  catch {
    return { ...fallbackPlan }
  }
}
