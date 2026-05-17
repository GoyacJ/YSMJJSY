import { readonly, ref } from 'vue'

export type AgentCoreProposalAction = 'accept' | 'reject'
export type MemoryGovernanceAction = 'confirm' | 'downgrade' | 'archive' | 'reject'

export type AgentContentStrategy = {
  replyLength?: 'short' | 'balanced' | 'rich'
  structure?: 'plain' | 'letter' | 'checklist'
  initiative?: 'low' | 'medium'
}

export type AgentCoreProposal = {
  id: string
  type: string
  title: string
  summary: string
  payload: Record<string, unknown>
  status: 'pending' | 'accepted' | 'rejected' | 'applied'
  createdAt: string
  updatedAt: string
}

export type AgentTimelineItem = {
  id: string
  type: 'key' | 'profile' | 'memory' | 'reflection' | 'sleep' | 'proposal' | 'work' | 'design'
  title: string
  summary: string
  createdAt: string
}

export type AgentCore = {
  profile: {
    keyId: string
    assistantName: string
    mbti: string
    configured: boolean
    tone: string
    relationshipRole: string
    learningMode: string
    contentStrategy: AgentContentStrategy
  }
  memoryCounts: {
    total: number
    active: number
    archived: number
    rejected: number
  }
  memories: Array<{
    id: string
    type: string
    content: string
    importance: number
    confidence: number
    createdAt: string
  }>
  latestReflections: Array<{
    id: string
    summary: string
    createdAt: string
  }>
  proposals: {
    pending: AgentCoreProposal[]
    history: AgentCoreProposal[]
  }
  sleep?: {
    lastSleepAt?: string | null
    nextSleepAt?: string | null
    latestRun?: {
      id: string
      status: 'running' | 'completed' | 'failed'
      summary: string
      startedAt: string
      completedAt?: string | null
      error?: string | null
    } | null
  }
}

export function useAgentCore() {
  const core = ref<AgentCore | null>(null)
  const timeline = ref<AgentTimelineItem[]>([])
  const pending = ref(false)
  const error = ref('')

  async function loadCore() {
    pending.value = true
    error.value = ''

    try {
      const result = await $fetch<AgentCore>('/api/agent/core')
      core.value = result
      return result
    }
    catch {
      error.value = 'Agent Core 没有加载成功。'
      return null
    }
    finally {
      pending.value = false
    }
  }

  async function applyProposal(id: string, action: AgentCoreProposalAction) {
    pending.value = true
    error.value = ''

    try {
      await $fetch(`/api/agent/proposals/${id}`, {
        method: 'PUT',
        body: { action },
      })
      await loadCore()
      return true
    }
    catch {
      error.value = '提案没有更新成功。'
      return false
    }
    finally {
      pending.value = false
    }
  }

  async function runSleep() {
    pending.value = true
    error.value = ''

    try {
      await $fetch('/api/agent/sleep', {
        method: 'POST',
      })
      await loadCore()
      return true
    }
    catch {
      error.value = '睡眠周期没有执行成功。'
      return false
    }
    finally {
      pending.value = false
    }
  }

  async function governMemory(id: string, action: MemoryGovernanceAction, reason = '') {
    pending.value = true
    error.value = ''

    try {
      await $fetch(`/api/agent/memories/${id}`, {
        method: 'PUT',
        body: { action, reason },
      })
      await loadCore()
      return true
    }
    catch {
      error.value = '记忆没有更新成功。'
      return false
    }
    finally {
      pending.value = false
    }
  }

  async function loadTimeline() {
    try {
      const result = await $fetch<{ items: AgentTimelineItem[] }>('/api/agent/timeline')
      timeline.value = result.items
      return result.items
    }
    catch {
      error.value = '时间线没有加载成功。'
      return []
    }
  }

  return {
    core: readonly(core),
    timeline: readonly(timeline),
    pending: readonly(pending),
    error: readonly(error),
    loadCore,
    applyProposal,
    runSleep,
    governMemory,
    loadTimeline,
  }
}
