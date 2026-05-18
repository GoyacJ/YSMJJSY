import { readonly, ref } from 'vue'

export type AgentOsInboxItem = {
  id: string
  type: 'proposal' | 'work_visibility'
  title: string
  summary: string
  action: 'approve' | 'publish'
  createdAt: string
}

export type AgentOsTaskItem = {
  id: string
  type: string
  status: string
  title: string
  summary: string
  result?: Record<string, unknown>
  error?: string | null
  createdAt: string
  updatedAt: string
}

export type AgentOsEventItem = {
  id: string
  type: string
  title: string
  summary: string
  targetType?: string | null
  targetId?: string | null
  createdAt: string
}

export type AgentOsState = {
  agent: {
    id: string
    status: string
    ownerType: string
    ownerId: string
    domain: string
  }
  inbox: AgentOsInboxItem[]
  tasks: AgentOsTaskItem[]
  events: AgentOsEventItem[]
}

export function useAgentOs() {
  const os = ref<AgentOsState | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadOs() {
    loading.value = true
    error.value = null

    try {
      os.value = await $fetch<AgentOsState>('/api/agents/current/os')
      return os.value
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : '加载 Agent OS 失败'
      return null
    }
    finally {
      loading.value = false
    }
  }

  async function approveInboxItem(id: string) {
    try {
      await $fetch(`/api/agents/current/inbox/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
      })
      await loadOs()
      return true
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : '批准待办失败'
      return false
    }
  }

  async function rejectInboxItem(id: string) {
    try {
      await $fetch(`/api/agents/current/inbox/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
      })
      await loadOs()
      return true
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : '拒绝待办失败'
      return false
    }
  }

  return {
    os: readonly(os),
    loading: readonly(loading),
    error: readonly(error),
    loadOs,
    approveInboxItem,
    rejectInboxItem,
  }
}
