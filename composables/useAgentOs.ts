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

type AgentTaskCreateInput = {
  type: string
  input?: Record<string, unknown>
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

  async function loadTasks() {
    try {
      const result = await $fetch<{ tasks: AgentOsTaskItem[] }>('/api/agents/current/tasks')

      if (os.value) {
        os.value = { ...os.value, tasks: result.tasks }
      }

      return result.tasks
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : '加载任务失败'
      return []
    }
  }

  async function enqueueTask(input: AgentTaskCreateInput) {
    try {
      const result = await $fetch<{ task: AgentOsTaskItem }>('/api/agents/current/tasks', {
        method: 'POST',
        body: input,
      })
      await loadTasks()
      return result.task
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : '创建任务失败'
      return null
    }
  }

  async function runTask(id: string) {
    try {
      await $fetch(`/api/agents/current/tasks/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: { action: 'run' },
      })
      await loadTasks()
      return true
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : '运行任务失败'
      return false
    }
  }

  async function cancelTask(id: string) {
    try {
      await $fetch(`/api/agents/current/tasks/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: { action: 'cancel' },
      })
      await loadTasks()
      return true
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : '取消任务失败'
      return false
    }
  }

  async function loadInbox() {
    try {
      const result = await $fetch<{ inbox: AgentOsInboxItem[] }>('/api/agents/current/inbox')

      if (os.value) {
        os.value = { ...os.value, inbox: result.inbox }
      }

      return result.inbox
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : '加载收件箱失败'
      return []
    }
  }

  async function loadEvents() {
    try {
      const result = await $fetch<{ events: AgentOsEventItem[] }>('/api/agents/current/events')

      if (os.value) {
        os.value = { ...os.value, events: result.events }
      }

      return result.events
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : '加载事件失败'
      return []
    }
  }

  return {
    os: readonly(os),
    loading: readonly(loading),
    error: readonly(error),
    loadOs,
    loadTasks,
    enqueueTask,
    runTask,
    cancelTask,
    loadInbox,
    loadEvents,
    approveInboxItem,
    rejectInboxItem,
  }
}
