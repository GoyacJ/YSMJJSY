import { readonly, ref } from 'vue'

export type AgentCoreProposalAction = 'accept' | 'reject'

export type AgentCore = {
  profile: {
    keyId: string
    assistantName: string
    mbti: string
    configured: boolean
  }
  memoryCounts: {
    total: number
    active: number
    archived: number
    rejected: number
  }
  latestReflections: Array<{
    id: string
    summary: string
    createdAt: string
  }>
  pendingProposals: Array<{
    id: string
    type: string
    title: string
    summary: string
    payload: Record<string, unknown>
    createdAt: string
  }>
}

export function useAgentCore() {
  const core = ref<AgentCore | null>(null)
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

  return {
    core: readonly(core),
    pending: readonly(pending),
    error: readonly(error),
    loadCore,
    applyProposal,
  }
}
