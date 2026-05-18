<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAgentCore, type AgentCore, type AgentCoreProposal, type AgentCoreProposalAction } from '../composables/useAgentCore'
import { useAgentOs, type AgentOsInboxItem, type AgentOsPlannedTaskItem, type AgentOsState, type AgentOsTaskItem, type AgentTaskCreateInput } from '../composables/useAgentOs'

const props = defineProps<{
  embedded?: boolean
  loadCore?: () => Promise<AgentCore | null>
  loadOs?: () => Promise<AgentOsState | null>
  applyProposal?: (id: string, action: AgentCoreProposalAction) => Promise<boolean>
  approveInboxItem?: (id: string) => Promise<boolean>
  rejectInboxItem?: (id: string) => Promise<boolean>
  enqueueTask?: (input: AgentTaskCreateInput) => Promise<AgentOsTaskItem | null>
  runTask?: (id: string) => Promise<boolean>
  cancelTask?: (id: string) => Promise<boolean>
  previewDesignProposal?: (id: string) => Promise<boolean>
  restoreSnapshot?: (id: string) => Promise<boolean>
  runSleep?: () => Promise<boolean>
}>()

const agentCore = useAgentCore()
const agentOs = useAgentOs()
const open = ref(false)
const loadedCore = ref<AgentCore | null>(null)
const loadedOs = ref<AgentOsState | null>(null)
const pending = ref(false)
const error = ref('')
const taskPrompt = ref('')

const core = computed(() => loadedCore.value)
const panelOpen = computed(() => props.embedded || open.value)
const inboxItems = computed(() => loadedOs.value?.inbox ?? [])
const osTasks = computed(() => loadedOs.value?.tasks ?? [])
const osEvents = computed(() => loadedOs.value?.events ?? [])
const plannedTasks = computed(() => loadedOs.value?.plannedTasks ?? [])
const pendingProposals = computed(() => core.value?.proposals.pending ?? [])
const pendingProposalLabel = computed(() => inboxItems.value.length ? '进化细节' : '待确认进化')
const proposalHistory = computed(() => core.value?.proposals.history ?? [])
const snapshotsByProposalId = computed(() => new Map((core.value?.snapshots ?? [])
  .filter(snapshot => snapshot.proposalId)
  .map(snapshot => [snapshot.proposalId, snapshot])))
const latestSleepRun = computed(() => core.value?.sleep?.latestRun ?? null)
const latestMemoryActionCount = computed(() => latestSleepRun.value?.memoryActions?.length ?? 0)
const latestWorkIdeas = computed(() => latestSleepRun.value?.workIdeas ?? [])
const latestConversationHints = computed(() => latestSleepRun.value?.nextConversationHints ?? [])

async function loadPanel() {
  pending.value = true
  error.value = ''

  try {
    const [nextCore, nextOs] = await Promise.all([
      props.loadCore ? props.loadCore() : agentCore.loadCore(),
      props.loadOs ? props.loadOs() : agentOs.loadOs(),
    ])

    loadedCore.value = nextCore
    loadedOs.value = nextOs
  }
  catch {
    error.value = 'Agent Core 没有加载成功。'
  }
  finally {
    pending.value = false
  }
}

async function openPanel() {
  open.value = !open.value

  if (open.value && !loadedCore.value) {
    await loadPanel()
  }
}

function normalizeInboxActionId(item: AgentOsInboxItem) {
  return item.id.includes(':') ? item.id : `${item.type}:${item.id}`
}

async function approveInbox(item: AgentOsInboxItem) {
  pending.value = true
  error.value = ''

  try {
    const id = normalizeInboxActionId(item)
    const ok = props.approveInboxItem
      ? await props.approveInboxItem(id)
      : await agentOs.approveInboxItem(id)

    if (ok) {
      await loadPanel()
    }
  }
  catch {
    error.value = '待办没有批准成功。'
  }
  finally {
    pending.value = false
  }
}

async function rejectInbox(item: AgentOsInboxItem) {
  pending.value = true
  error.value = ''

  try {
    const id = normalizeInboxActionId(item)
    const ok = props.rejectInboxItem
      ? await props.rejectInboxItem(id)
      : await agentOs.rejectInboxItem(id)

    if (ok) {
      await loadPanel()
    }
  }
  catch {
    error.value = '待办没有拒绝成功。'
  }
  finally {
    pending.value = false
  }
}

async function runOsTask(id: string) {
  pending.value = true
  error.value = ''

  try {
    const ok = props.runTask
      ? await props.runTask(id)
      : await agentOs.runTask(id)

    if (ok) {
      await loadPanel()
    }
  }
  catch {
    error.value = '任务没有运行成功。'
  }
  finally {
    pending.value = false
  }
}

async function cancelOsTask(id: string) {
  pending.value = true
  error.value = ''

  try {
    const ok = props.cancelTask
      ? await props.cancelTask(id)
      : await agentOs.cancelTask(id)

    if (ok) {
      await loadPanel()
    }
  }
  catch {
    error.value = '任务没有取消成功。'
  }
  finally {
    pending.value = false
  }
}

async function createImageTask() {
  const prompt = taskPrompt.value.trim()

  if (!prompt) {
    return
  }

  const created = props.enqueueTask
    ? await props.enqueueTask({ type: 'generate_artifact', input: { artifactType: 'image', prompt } })
    : await agentOs.enqueueTask({ type: 'generate_artifact', input: { artifactType: 'image', prompt } })

  if (created) {
    taskPrompt.value = ''
    await loadPanel()
  }
}

async function createPlannedTask(task: AgentOsPlannedTaskItem) {
  const created = props.enqueueTask
    ? await props.enqueueTask({ type: task.type, input: task.input ?? {} })
    : await agentOs.enqueueTask({ type: task.type, input: task.input ?? {} })

  if (created) {
    await loadPanel()
  }
}

async function updateProposal(id: string, action: AgentCoreProposalAction) {
  pending.value = true
  error.value = ''

  try {
    const ok = props.applyProposal
      ? await props.applyProposal(id, action)
      : await agentCore.applyProposal(id, action)

    if (ok) {
      await loadPanel()
    }
  }
  catch {
    error.value = '提案没有更新成功。'
  }
  finally {
    pending.value = false
  }
}

async function previewProposal(id: string) {
  if (!props.previewDesignProposal) {
    return
  }

  pending.value = true
  error.value = ''

  try {
    const ok = await props.previewDesignProposal(id)

    if (!ok) {
      error.value = '设计提案预览没有生成成功。'
    }
  }
  catch {
    error.value = '设计提案预览没有生成成功。'
  }
  finally {
    pending.value = false
  }
}

async function restoreProposalSnapshot(proposalId: string) {
  const snapshot = snapshotsByProposalId.value.get(proposalId)

  if (!snapshot) {
    return
  }

  pending.value = true
  error.value = ''

  try {
    const ok = props.restoreSnapshot
      ? await props.restoreSnapshot(snapshot.id)
      : await agentCore.restoreSnapshot(snapshot.id)

    if (ok) {
      await loadPanel()
    }
  }
  catch {
    error.value = '快照没有恢复成功。'
  }
  finally {
    pending.value = false
  }
}

async function triggerSleep() {
  pending.value = true
  error.value = ''

  try {
    const ok = props.runSleep
      ? await props.runSleep()
      : await agentCore.runSleep()

    if (ok) {
      await loadPanel()
    }
  }
  catch {
    error.value = '睡眠周期没有执行成功。'
  }
  finally {
    pending.value = false
  }
}

function formatTime(value?: string | null) {
  if (!value) return '未记录'
  return value.replace('T', ' ').replace('.000Z', '')
}

function describeProposalEffect(proposal: AgentCoreProposal) {
  const tone = proposal.payload.tone
  const relationshipRole = proposal.payload.relationshipRole
  const strategy = proposal.payload.strategy ?? proposal.payload.contentStrategy

  if (proposal.type === 'tone' && typeof tone === 'string' && tone) {
    return `语气会调整为${tone}`
  }

  if (proposal.type === 'relationship_role' && typeof relationshipRole === 'string' && relationshipRole) {
    return `关系会调整为${relationshipRole}`
  }

  if (proposal.type === 'content_strategy' && typeof strategy === 'string' && strategy) {
    return `回应策略会调整为${strategy}`
  }

  return proposal.summary
}

function getProposalStatusLabel(status: AgentCoreProposal['status']) {
  if (status === 'accepted') return '已接受'
  if (status === 'applied') return '已应用'
  if (status === 'rejected') return '已拒绝'
  return '待确认'
}

function readText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function getWorkIdeaTitle(idea: Record<string, unknown>) {
  return readText(idea.title) || readText(idea.summary) || '未命名想法'
}

function getInboxApproveLabel(item: AgentOsInboxItem) {
  if (item.type === 'work_visibility') return '公开'
  if (item.type === 'memory_governance') return '执行'
  if (item.type === 'rollback') return '回滚'
  return '批准'
}

onMounted(() => {
  if (props.embedded) {
    void loadPanel()
  }
})
</script>

<template>
  <aside class="agent-core-panel" :class="{ 'agent-core-panel--embedded': embedded }" aria-label="星AI">
    <button
      v-if="!embedded"
      type="button"
      class="agent-core-panel__trigger"
      :aria-expanded="open"
      @click="openPanel"
    >
      打开星AI
    </button>

    <section v-if="panelOpen" class="agent-core-panel__sheet">
      <header>
        <div>
          <p>星AI</p>
          <span v-if="core">{{ core.profile.assistantName }} · {{ core.profile.mbti }}</span>
          <span v-if="loadedOs">{{ loadedOs.agent.status }} · {{ loadedOs.agent.domain }}</span>
        </div>
        <button v-if="!embedded" type="button" class="dialog-close-button" aria-label="关闭面板" @click="open = false">
          ×
        </button>
      </header>

      <p v-if="pending" class="agent-core-panel__muted">
        正在读取
      </p>
      <p v-else-if="error" class="agent-core-panel__error" role="alert">
        {{ error }}
      </p>

      <template v-if="core">
        <div class="agent-core-panel__counts">
          <span>记忆 {{ core.memoryCounts.active }}/{{ core.memoryCounts.total }}</span>
          <span>归档 {{ core.memoryCounts.archived }}</span>
        </div>

        <section class="agent-core-panel__inbox">
          <p class="agent-core-panel__label">
            决策收件箱
          </p>
          <ul v-if="inboxItems.length">
            <li v-for="item in inboxItems" :key="`${item.type}:${item.id}`">
              <strong>{{ item.title }}</strong>
              <span>{{ item.summary }}</span>
              <div>
                <button
                  type="button"
                  :disabled="pending"
                  @click="approveInbox(item)"
                >
                  {{ getInboxApproveLabel(item) }}
                </button>
                <button
                  type="button"
                  :disabled="pending"
                  @click="rejectInbox(item)"
                >
                  拒绝
                </button>
              </div>
            </li>
          </ul>
          <p v-else class="agent-core-panel__muted">
            没有待处理事项
          </p>
        </section>

        <section class="agent-core-panel__tasks">
          <p class="agent-core-panel__label">
            任务中心
          </p>
          <div class="agent-core-panel__task-create">
            <input v-model="taskPrompt" aria-label="任务提示词" maxlength="120">
            <button
              type="button"
              aria-label="创建图片任务"
              :disabled="pending || !taskPrompt.trim()"
              @click="createImageTask"
            >
              图片任务
            </button>
          </div>
          <ul v-if="plannedTasks.length" class="agent-core-panel__planned-tasks">
            <li v-for="planned in plannedTasks" :key="`${planned.type}:${planned.title}`">
              <strong>{{ planned.title }}</strong>
              <span>{{ planned.summary }}</span>
              <button
                type="button"
                aria-label="创建计划任务"
                :disabled="pending"
                @click="createPlannedTask(planned)"
              >
                创建任务
              </button>
            </li>
          </ul>
          <ul v-if="osTasks.length">
            <li v-for="task in osTasks" :key="task.id" class="agent-core-panel__task">
              <strong>{{ task.title }}</strong>
              <span>{{ task.summary }}</span>
              <small>{{ task.status }}</small>
              <div v-if="task.status === 'queued' || task.status === 'waiting_approval'">
                <button
                  type="button"
                  :disabled="pending"
                  @click="runOsTask(task.id)"
                >
                  运行
                </button>
                <button
                  type="button"
                  :disabled="pending"
                  @click="cancelOsTask(task.id)"
                >
                  取消
                </button>
              </div>
            </li>
          </ul>
          <p v-else class="agent-core-panel__muted">
            还没有任务
          </p>
        </section>

        <section class="agent-core-panel__events">
          <p class="agent-core-panel__label">
            审计事件
          </p>
          <ul v-if="osEvents.length">
            <li v-for="event in osEvents" :key="event.id">
              <strong>{{ event.title }}</strong>
              <span>{{ event.summary }}</span>
              <small>{{ event.type }} · {{ formatTime(event.createdAt) }}</small>
            </li>
          </ul>
          <p v-else class="agent-core-panel__muted">
            还没有事件
          </p>
        </section>

        <section>
          <p class="agent-core-panel__label">
            当前状态
          </p>
          <dl class="agent-core-panel__status">
            <div>
              <dt>语气</dt>
              <dd>{{ core.profile.tone }}</dd>
            </div>
            <div>
              <dt>关系</dt>
              <dd>{{ core.profile.relationshipRole }}</dd>
            </div>
            <div>
              <dt>学习</dt>
              <dd>{{ core.profile.learningMode }}</dd>
            </div>
          </dl>
        </section>

        <section>
          <p class="agent-core-panel__label">
            睡眠周期
          </p>
          <dl class="agent-core-panel__status">
            <div>
              <dt>上次思考</dt>
              <dd>{{ formatTime(core.sleep?.lastSleepAt) }}</dd>
            </div>
            <div>
              <dt>下次提醒</dt>
              <dd>{{ formatTime(core.sleep?.nextSleepAt) }}</dd>
            </div>
            <div v-if="latestSleepRun">
              <dt>最近报告</dt>
              <dd>{{ latestSleepRun.summary || latestSleepRun.status }}</dd>
            </div>
            <div v-if="latestSleepRun">
              <dt>记忆动作</dt>
              <dd>{{ latestMemoryActionCount }}</dd>
            </div>
          </dl>
          <div v-if="latestSleepRun" class="agent-core-panel__sleep-report">
            <p>记忆动作 {{ latestMemoryActionCount }}</p>
            <template v-if="latestWorkIdeas.length">
              <p>作品想法</p>
              <ul>
                <li v-for="(idea, index) in latestWorkIdeas" :key="index">
                  {{ getWorkIdeaTitle(idea) }}
                </li>
              </ul>
            </template>
            <template v-if="latestConversationHints.length">
              <p>下次对话</p>
              <ul>
                <li v-for="hint in latestConversationHints" :key="hint">
                  {{ hint }}
                </li>
              </ul>
            </template>
          </div>
          <button
            type="button"
            class="agent-core-panel__action"
            aria-label="让智能体思考"
            :disabled="pending"
            @click="triggerSleep"
          >
            {{ pending ? '正在思考' : '让它想一会儿' }}
          </button>
        </section>

        <section>
          <p class="agent-core-panel__label">
            最近反思
          </p>
          <ul v-if="core.latestReflections.length">
            <li v-for="reflection in core.latestReflections" :key="reflection.id">
              {{ reflection.summary }}
            </li>
          </ul>
          <p v-else class="agent-core-panel__muted">
            还没有反思
          </p>
        </section>

        <section>
          <p class="agent-core-panel__label">
            {{ pendingProposalLabel }}
          </p>
          <ul v-if="pendingProposals.length" class="agent-core-panel__proposals">
            <li v-for="proposal in pendingProposals" :key="proposal.id">
              <strong>{{ proposal.title }}</strong>
              <span>{{ proposal.summary }}</span>
              <span>接受后：{{ describeProposalEffect(proposal) }}</span>
              <div v-if="proposal.type === 'page_design'">
                <button
                  type="button"
                  aria-label="生成设计预览"
                  :disabled="pending"
                  @click="previewProposal(proposal.id)"
                >
                  生成预览
                </button>
              </div>
              <div v-else>
                <button
                  type="button"
                  aria-label="接受提案"
                  :disabled="pending"
                  @click="updateProposal(proposal.id, 'accept')"
                >
                  接受
                </button>
                <button
                  type="button"
                  aria-label="拒绝提案"
                  :disabled="pending"
                  @click="updateProposal(proposal.id, 'reject')"
                >
                  拒绝
                </button>
              </div>
            </li>
          </ul>
          <p v-else class="agent-core-panel__muted">
            没有待确认提案
          </p>
        </section>

        <section>
          <p class="agent-core-panel__label">
            进化历史
          </p>
          <ul v-if="proposalHistory.length" class="agent-core-panel__proposals">
            <li v-for="proposal in proposalHistory" :key="proposal.id">
              <strong>{{ proposal.title }}</strong>
              <span>{{ proposal.summary }}</span>
              <span>{{ getProposalStatusLabel(proposal.status) }}</span>
              <button
                v-if="proposal.status === 'applied' && snapshotsByProposalId.has(proposal.id)"
                type="button"
                aria-label="回滚提案"
                :disabled="pending"
                @click="restoreProposalSnapshot(proposal.id)"
              >
                回滚
              </button>
            </li>
          </ul>
          <p v-else class="agent-core-panel__muted">
            还没有进化历史
          </p>
        </section>
      </template>
    </section>
  </aside>
</template>
