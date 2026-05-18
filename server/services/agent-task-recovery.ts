import type { AgentEventRecord, AgentTaskRecord } from '../db/sqlite'
import { failAgentTask } from './agent-task-queue'

export function recoverStaleRunningTasks(input: {
  now: string
  staleAfterMs: number
  tasks: AgentTaskRecord[]
  taskRepo: { updateTask: (id: string, updates: Partial<Pick<AgentTaskRecord, 'status' | 'resultJson' | 'error' | 'updatedAt'>>) => void }
  events: { addEvent: (record: AgentEventRecord) => void }
}) {
  for (const task of input.tasks) {
    if (Date.parse(input.now) - Date.parse(task.updatedAt) < input.staleAfterMs) {
      continue
    }

    failAgentTask({
      task,
      error: 'Task recovered as failed after stale running state.',
      now: input.now,
      tasks: input.taskRepo,
      events: input.events,
    })
  }
}
