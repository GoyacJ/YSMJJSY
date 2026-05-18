import type { AgentObservationRecord, AgentTaskRecord, AgentTaskType } from '../db/sqlite'

export type PlannedAgentTask = {
  type: AgentTaskType
  title: string
  summary: string
  input: Record<string, unknown>
}

export function planAgentTasksFromObservations(input: {
  observations: Array<Pick<AgentObservationRecord, 'sourceType' | 'summary' | 'createdAt'>>
  existingTasks: Array<Pick<AgentTaskRecord, 'type' | 'status'>>
  threshold?: number
}): PlannedAgentTask[] {
  const threshold = input.threshold ?? 6
  const hasActiveSleep = input.existingTasks.some(task =>
    task.type === 'sleep' && (task.status === 'queued' || task.status === 'running' || task.status === 'waiting_approval')
  )

  if (hasActiveSleep) {
    return []
  }

  const chatObservationCount = input.observations.filter(item => item.sourceType === 'chat').length

  if (chatObservationCount < threshold) {
    return []
  }

  return [{
    type: 'sleep',
    title: '睡眠整理',
    summary: '根据最近观察整理记忆和提案。',
    input: { toolName: 'star.sleep', input: {} },
  }]
}
