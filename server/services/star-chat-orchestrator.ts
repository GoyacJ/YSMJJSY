import type { AgentEventRecord, AgentTaskRecord } from '../db/sqlite'
import type { AgentPolicy } from './agent-policy'
import type { AgentToolDefinition, AgentToolRegistry } from './agent-runtime'
import { buildChatToolCandidates, searchAgentTools } from './agent-tool-catalog'
import type { MiniMaxMessage } from './minimax'
import type { StarChatApiReply, StarChatMessagePart, StarChatStreamEvent } from './star-chat'
import { executeStarChatToolCalls, normalizeStarChatToolCalls } from './star-chat-tool-execution'
import {
  planStarChatAction,
  toStarChatToolCard,
  validateStarChatAction,
  type StarChatActionPlannerProvider,
  type StarChatScratchpadItem,
  type StarChatToolCallAction,
} from './star-chat-planner'

const maxModelTurns = 6
const maxSearches = 2
const maxToolCalls = 4
const maxInvalidActions = 2

type TaskRepository = {
  addTask: (record: AgentTaskRecord) => void
  updateTask: (id: string, updates: Partial<Pick<AgentTaskRecord, 'status' | 'resultJson' | 'error' | 'updatedAt'>>) => void
}

type EventRepository = {
  addEvent: (record: AgentEventRecord) => void
}

function uniqueToolsByName(tools: AgentToolDefinition[]): AgentToolDefinition[] {
  return Array.from(new Map(tools.map(tool => [tool.name, tool])).values())
}

function buildToolStatusPart(text: string): StarChatMessagePart {
  return { type: 'status', text }
}

async function emitToolStatus(
  input: { emit: (event: StarChatStreamEvent) => void | Promise<void> },
  text: string,
  visibility: 'user' | 'debug' = 'user',
) {
  await input.emit({ type: 'tool-status', text, visibility })
}

function hasMediaPart(parts: StarChatMessagePart[]) {
  return parts.some(part => part.type === 'audio' || part.type === 'image' || part.type === 'music' || part.type === 'video')
}

function isCompletedStatusPart(part: StarChatMessagePart) {
  return part.type === 'status' && /已完成。?$/.test(part.text)
}

function buildFinalParts(reply: string, parts: StarChatMessagePart[]): StarChatMessagePart[] {
  const visibleParts = hasMediaPart(parts)
    ? parts.filter(part => part.type !== 'status')
    : parts.filter(part => !isCompletedStatusPart(part))

  return [
    { type: 'text', text: reply },
    ...visibleParts,
  ]
}

function buildToolStatusText(input: { status: string, title?: string, error?: string, result?: Record<string, unknown> }) {
  if (
    input.status === 'completed'
    && input.result?.type === 'music'
    && input.result.status === 'processing'
  ) {
    return '音乐生成已开始。'
  }

  if (
    input.status === 'completed'
    && input.result?.type === 'video'
    && input.result.status === 'processing'
  ) {
    return '视频任务已提交。'
  }

  if (input.status === 'completed') {
    return `${input.title ?? '工具'}已完成。`
  }

  if (input.status === 'waiting_approval') {
    return `${input.title ?? '工具'}等待确认。`
  }

  if (input.status === 'denied' || input.status === 'rejected') {
    return input.error ?? `${input.title ?? '工具'}未执行。`
  }

  if (input.status === 'failed') {
    return input.error ?? `${input.title ?? '工具'}执行失败。`
  }

  return `${input.title ?? '工具'}已更新。`
}

function buildSafeToolStatusText(input: { status: string, title?: string, result?: Record<string, unknown> }) {
  if (input.status === 'failed') {
    return `${input.title ?? '工具'}执行失败。`
  }

  return buildToolStatusText(input)
}

function addValidationError(input: {
  reason: string
  validationErrors: string[]
  scratchpad: StarChatScratchpadItem[]
}) {
  input.validationErrors.push(input.reason)
  input.scratchpad.push({ type: 'validation_error', reason: input.reason })
}

function buildCapabilityToolNames(input: {
  prompt: string
  attachmentKinds: string[]
  tools: AgentToolDefinition[]
}) {
  return new Set(searchAgentTools({
    tools: input.tools,
    query: [
      input.prompt,
      ...input.attachmentKinds,
    ].filter(Boolean).join(' '),
    limit: 6,
  }).map(tool => tool.name))
}

function buildFinalResult(reply: string, parts: StarChatMessagePart[]): StarChatApiReply {
  return {
    reply,
    message: {
      role: 'assistant',
      content: reply,
      parts: buildFinalParts(reply, parts),
    },
  }
}

function buildRecoveredReply(parts: StarChatMessagePart[]) {
  const mediaTypes = new Set(parts
    .filter(part => part.type === 'audio' || part.type === 'image' || part.type === 'music' || part.type === 'video')
    .map(part => part.type))
  const processingTypes = new Set(parts
    .filter(part => (part.type === 'music' || part.type === 'video') && part.status === 'processing')
    .map(part => part.type))

  if (mediaTypes.size > 1) {
    if (processingTypes.size > 0) {
      return '任务已开始。'
    }

    return '已经做好了。'
  }

  if (mediaTypes.has('music')) {
    if (processingTypes.has('music')) {
      return '音乐生成已开始。'
    }

    return '音乐做好了。'
  }

  if (mediaTypes.has('image')) {
    return '图片做好了。'
  }

  if (mediaTypes.has('audio')) {
    return '语音做好了。'
  }

  if (mediaTypes.has('video')) {
    return '视频任务已提交。'
  }

  if (parts.some(part => part.type === 'status' && part.text.includes('等待确认'))) {
    return '需要你确认后我再执行。'
  }

  return ''
}

function hasFailedToolStatus(parts: StarChatMessagePart[]) {
  return parts.some(part =>
    part.type === 'status'
    && /失败|未执行|拒绝|denied|rejected|failed/i.test(part.text),
  )
}

function isFailureLikeReply(reply: string) {
  return /工具规划失败|规划失败|执行失败|生成失败|出错|走神|重试|等一下再试|稍后再试|无法完成/.test(reply)
}

function shouldRejectResultOverridingReply(input: {
  reply: string
  parts: StarChatMessagePart[]
}) {
  return Boolean(buildRecoveredReply(input.parts))
    && !hasFailedToolStatus(input.parts)
    && isFailureLikeReply(input.reply)
}

function canUseRawReplyAsAnswer(input: {
  rawReply: string
  capabilityToolNames: Set<string>
  searchCount: number
  toolCallCount: number
}) {
  return input.capabilityToolNames.size === 0
    && input.searchCount === 0
    && input.toolCallCount === 0
    && Boolean(input.rawReply.trim())
}

export async function runStarChatToolOrchestrator(input: {
  prompt: string
  attachmentKinds?: Array<'image' | 'video' | 'audio'>
  recentToolNames?: string[]
  baseMessages: MiniMaxMessage[]
  provider: StarChatActionPlannerProvider
  registry: Pick<AgentToolRegistry, 'list' | 'get' | 'execute'>
  commonToolNames: string[]
  agentId: string
  now: string
  tasks: TaskRepository
  events: EventRepository
  policy: Partial<AgentPolicy>
  emit: (event: StarChatStreamEvent) => void | Promise<void>
}): Promise<StarChatApiReply> {
  const tools = input.registry.list()
  const candidates = buildChatToolCandidates({
    tools,
    message: input.prompt,
    attachmentKinds: input.attachmentKinds ?? [],
    recentToolNames: input.recentToolNames ?? [],
    commonToolNames: input.commonToolNames,
  })
  const commonTools = candidates.commonTools
  const recentTools = candidates.recentTools
  let searchedTools: AgentToolDefinition[] = []
  const scratchpad: StarChatScratchpadItem[] = []
  const validationErrors: string[] = []
  const parts: StarChatMessagePart[] = []
  const exposedToolNames = new Set([...commonTools, ...recentTools].map(tool => tool.name))
  const capabilityToolNames = buildCapabilityToolNames({
    prompt: input.prompt,
    attachmentKinds: input.attachmentKinds ?? [],
    tools,
  })
  const handledToolNames = new Set<string>()
  let searchCount = 0
  let toolCallCount = 0
  let invalidActionCount = 0

  await emitToolStatus(input, '正在分析可用工具。')

  for (let turn = 0; turn < maxModelTurns; turn += 1) {
    const parsed = await planStarChatAction({
      provider: input.provider,
      messages: input.baseMessages,
      commonTools,
      recentTools,
      searchedTools,
      scratchpad,
      validationErrors,
    })

    if (!parsed.valid) {
      if (canUseRawReplyAsAnswer({
        rawReply: parsed.rawReply,
        capabilityToolNames,
        searchCount,
        toolCallCount,
      })) {
        const reply = parsed.rawReply
        await input.emit({ type: 'delta', text: reply })
        const result = buildFinalResult(reply, parts)
        await input.emit({ type: 'message', ...result })
        return result
      }

      invalidActionCount += 1
      addValidationError({ reason: parsed.reason, validationErrors, scratchpad })

      if (invalidActionCount > maxInvalidActions) {
        break
      }

      continue
    }

    const validation = validateStarChatAction({
      action: parsed.action,
      exposedToolNames,
      availableTools: tools,
      searchCount,
      maxSearches,
      capabilityToolNames,
      policy: input.policy,
    })

    if (!validation.valid) {
      invalidActionCount += 1
      addValidationError({ reason: validation.reason, validationErrors, scratchpad })

      if (invalidActionCount > maxInvalidActions) {
        break
      }

      continue
    }

    if (parsed.action.type === 'answer' || parsed.action.type === 'clarify' || parsed.action.type === 'unavailable') {
      if (shouldRejectResultOverridingReply({ reply: parsed.action.reply, parts })) {
        invalidActionCount += 1
        addValidationError({
          reason: 'Action reply conflicts with completed tool results. Answer using scratchpad instead.',
          validationErrors,
          scratchpad,
        })

        if (invalidActionCount > maxInvalidActions) {
          break
        }

        continue
      }

      invalidActionCount = 0
      validationErrors.length = 0

      await input.emit({ type: 'delta', text: parsed.action.reply })
      const result = buildFinalResult(parsed.action.reply, parts)
      await input.emit({ type: 'message', ...result })
      return result
    }

    if (parsed.action.type === 'tool_search') {
      invalidActionCount = 0
      validationErrors.length = 0
      searchCount += 1
      const results = searchAgentTools({
        tools,
        query: parsed.action.query,
        category: parsed.action.category,
        behavior: parsed.action.behavior,
        limit: parsed.action.limit,
      })

      searchedTools = uniqueToolsByName([...searchedTools, ...results])

      for (const tool of results) {
        exposedToolNames.add(tool.name)
      }

      scratchpad.push({
        type: 'tool_search_result',
        query: parsed.action.query,
        tools: results.map(toStarChatToolCard),
      })
      await emitToolStatus(input, `已搜索到 ${results.length} 个工具。`)
      continue
    }

    if (parsed.action.type === 'tool_call') {
      if (handledToolNames.has(parsed.action.toolName)) {
        invalidActionCount += 1
        addValidationError({
          reason: `Tool already has a result in this turn: ${parsed.action.toolName}. Answer using scratchpad instead.`,
          validationErrors,
          scratchpad,
        })

        if (invalidActionCount > maxInvalidActions) {
          break
        }

        continue
      }

      if (toolCallCount >= maxToolCalls) {
        addValidationError({ reason: 'Tool call limit reached', validationErrors, scratchpad })
        continue
      }

      invalidActionCount = 0
      validationErrors.length = 0
      toolCallCount += 1
      await emitToolStatus(input, parsed.action.reason || '正在准备工具。')

      const calls = normalizeStarChatToolCalls({
        action: parsed.action as StarChatToolCallAction,
        registry: input.registry,
        reply: '',
      })
      const toolResults = await executeStarChatToolCalls({
        agentId: input.agentId,
        now: input.now,
        calls,
        tasks: input.tasks,
        events: input.events,
        registry: input.registry,
        policy: input.policy,
      })

      for (const toolResult of toolResults) {
        const statusText = buildToolStatusText(toolResult)
        const safeStatusText = buildSafeToolStatusText(toolResult)

        if (toolResult.chatParts?.length) {
          parts.push(...toolResult.chatParts)
        }

        parts.push(buildToolStatusPart(safeStatusText))

        if (toolResult.status === 'completed' || toolResult.status === 'waiting_approval') {
          handledToolNames.add(toolResult.toolName)
        }

        scratchpad.push({
          type: 'tool_result',
          toolName: toolResult.toolName,
          status: toolResult.status,
          output: toolResult.result,
          error: toolResult.error,
        })

        if (toolResult.status === 'waiting_approval' && toolResult.taskId && toolResult.inboxItemId) {
          await input.emit({
            type: 'tool-confirmation',
            taskId: toolResult.taskId,
            inboxItemId: toolResult.inboxItemId,
            title: toolResult.title ?? toolResult.toolName,
            summary: toolResult.summary ?? statusText,
          })
        }
        else {
          if (toolResult.status === 'failed' && toolResult.error) {
            await emitToolStatus(input, statusText, 'debug')
          }
          else {
            await emitToolStatus(input, safeStatusText)
          }
        }
      }
    }
  }

  const recoveredReply = buildRecoveredReply(parts)

  if (recoveredReply) {
    const result = buildFinalResult(recoveredReply, parts)
    await input.emit({ type: 'message', ...result })
    return result
  }

  const reply = '工具规划失败，请重试。'
  const result = buildFinalResult(reply, parts.length ? parts : [buildToolStatusPart(reply)])
  await emitToolStatus(input, reply)
  await input.emit({ type: 'message', ...result })
  return result
}
