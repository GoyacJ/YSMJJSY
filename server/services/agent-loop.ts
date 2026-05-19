import type { AgentEventRecord, AgentTaskRecord } from '../db/sqlite'
import type { AgentPolicy } from './agent-policy'
import { planAgentTasksFromObservations } from './agent-loop-planner'
import type { PlannedAgentTask } from './agent-loop-planner'
import { runAgentTask } from './agent-task-queue'
import type { AgentTaskRunResult } from './agent-task-queue'
import type { AgentToolRegistry } from './agent-runtime'

type TaskRepository = {
  updateTask: (id: string, updates: Partial<Pick<AgentTaskRecord, 'status' | 'resultJson' | 'error' | 'updatedAt'>>) => void
}

type EventRepository = {
  addEvent: (record: AgentEventRecord) => void
}

export type AgentLoop = {
  runTask: (task: AgentTaskRecord, options?: { approvalGranted?: boolean }) => Promise<AgentTaskRunResult>
  planTasks: (input: {
    observations: Parameters<typeof planAgentTasksFromObservations>[0]['observations']
    existingTasks: Parameters<typeof planAgentTasksFromObservations>[0]['existingTasks']
  }) => PlannedAgentTask[]
  recoverTasks: (tasks: AgentTaskRecord[]) => AgentTaskRecord[]
}

export function createAgentLoop(input: {
  now: string
  tasks: TaskRepository
  events: EventRepository
  registry: Pick<AgentToolRegistry, 'get' | 'execute'>
  policy: Partial<AgentPolicy>
}): AgentLoop {
  return {
    runTask(task, options) {
      return runAgentTask({
        task,
        now: input.now,
        tasks: input.tasks,
        events: input.events,
        registry: input.registry,
        policy: input.policy,
        approvalGranted: options?.approvalGranted,
      })
    },
    planTasks(planInput) {
      return planAgentTasksFromObservations({ ...planInput, threshold: 3 })
    },
    recoverTasks(tasks) {
      return tasks.filter(task => task.status === 'running')
    },
  }
}
