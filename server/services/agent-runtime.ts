import type { ChatResult, DesignPatchInput, MiniMaxMessage, createMiniMaxClient } from './minimax'

export type AgentToolRiskLevel = 'low' | 'medium' | 'high'

export type AgentToolResult<Output = unknown> = {
  ok: boolean
  output?: Output
  error?: string
}

export type AgentTool<Input = unknown, Output = unknown> = {
  name: string
  description: string
  riskLevel: AgentToolRiskLevel
  approvalRequired: boolean
  execute: (input: Input) => Promise<AgentToolResult<Output>>
}

export type AgentToolDefinition = Omit<AgentTool, 'execute'>

export type AgentToolRegistry = {
  register: (tool: AgentTool) => void
  get: (name: string) => AgentTool | undefined
  list: () => AgentToolDefinition[]
  execute: (name: string, input: unknown) => Promise<AgentToolResult>
}

type MiniMaxAgentModelClient = Pick<
  ReturnType<typeof createMiniMaxClient>,
  'chat' | 'reflectAgent' | 'generateDesignPatch'
>

export type AgentModelProvider = {
  chat: (messages: MiniMaxMessage[]) => Promise<ChatResult>
  reflect: (messages: MiniMaxMessage[]) => Promise<string>
  generateDesignPatch: (input: DesignPatchInput) => Promise<unknown>
}

export function createAgentToolRegistry(): AgentToolRegistry {
  const tools = new Map<string, AgentTool>()

  return {
    register(tool) {
      tools.set(tool.name, tool)
    },

    get(name) {
      return tools.get(name)
    },

    list() {
      return Array.from(tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        riskLevel: tool.riskLevel,
        approvalRequired: tool.approvalRequired,
      }))
    },

    async execute(name, input) {
      const tool = tools.get(name)

      if (!tool) {
        throw new Error(`Agent tool not found: ${name}`)
      }

      return tool.execute(input)
    },
  }
}

export function createMiniMaxAgentModelProvider(client: MiniMaxAgentModelClient): AgentModelProvider {
  return {
    chat(messages) {
      return client.chat(messages)
    },

    reflect(messages) {
      return client.reflectAgent(messages)
    },

    generateDesignPatch(input) {
      return client.generateDesignPatch(input)
    },
  }
}
