# Agent OS Runtime

Agent OS is the runtime layer below 星AI business features.

## Runtime Flow

1. Business route records observations.
2. AgentLoop reads observations and existing tasks.
3. Planner proposes safe tasks.
4. User or route enqueues a task.
5. Policy evaluates the tool.
6. Task runs or waits for approval.
7. Tool events and task events are written.
8. Inbox approval resumes waiting tasks.
9. Recovery marks stale running tasks as failed.

## Boundaries

- Business routes may collect context.
- Business routes must not bypass policy for high-risk mutations.
- Agent tools execute mutations.
- Agent OS serializes safe status only.
