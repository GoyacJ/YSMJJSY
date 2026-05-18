import type { AgentEventRecord, AgentTaskRecord } from '../db/sqlite'
import type { AgentPolicy } from './agent-policy'
import { runAgentTask } from './agent-task-queue'
import type { AgentToolRegistry } from './agent-runtime'

type TaskRepository = {
  updateTask: (id: string, updates: Partial<Pick<AgentTaskRecord, 'status' | 'resultJson' | 'error' | 'updatedAt'>>) => void
}

type EventRepository = {
  addEvent: (record: AgentEventRecord) => void
}

export type AgentLoop = {
  runTask: (task: AgentTaskRecord, options?: { approvalGranted?: boolean }) => Promise<void>
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
  }
}
