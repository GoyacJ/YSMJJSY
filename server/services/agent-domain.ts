export type AgentObservationSourceType = 'chat' | 'media' | 'design' | 'approval' | 'memory' | 'system'

export type AgentEventType =
  | 'observation.created'
  | 'task.queued'
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'task.cancelled'
  | 'approval.required'
  | 'approval.approved'
  | 'approval.rejected'
  | 'tool.started'
  | 'tool.completed'
  | 'tool.failed'
  | 'provider.failed'
  | 'policy.denied'

export type AgentInboxItemType =
  | 'proposal'
  | 'work_visibility'
  | 'memory_governance'
  | 'task_approval'
  | 'rollback'
