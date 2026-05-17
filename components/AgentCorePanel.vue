<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAgentCore, type AgentCore, type AgentCoreProposal, type AgentCoreProposalAction } from '../composables/useAgentCore'

const props = defineProps<{
  embedded?: boolean
  loadCore?: () => Promise<AgentCore | null>
  applyProposal?: (id: string, action: AgentCoreProposalAction) => Promise<boolean>
}>()

const agentCore = useAgentCore()
const open = ref(false)
const loadedCore = ref<AgentCore | null>(null)
const pending = ref(false)
const error = ref('')

const core = computed(() => loadedCore.value)
const panelOpen = computed(() => props.embedded || open.value)
const pendingProposals = computed(() => core.value?.proposals.pending ?? [])
const proposalHistory = computed(() => core.value?.proposals.history ?? [])

async function loadPanel() {
  pending.value = true
  error.value = ''

  try {
    loadedCore.value = props.loadCore ? await props.loadCore() : await agentCore.loadCore()
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
      aria-label="打开星AI"
      :aria-expanded="open"
      @click="openPanel"
    >
      星AI
    </button>

    <section v-if="panelOpen" class="agent-core-panel__sheet">
      <header>
        <div>
          <p>星AI</p>
          <span v-if="core">{{ core.profile.assistantName }} · {{ core.profile.mbti }}</span>
        </div>
        <button v-if="!embedded" type="button" aria-label="关闭星AI" @click="open = false">
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
            待确认进化
          </p>
          <ul v-if="pendingProposals.length" class="agent-core-panel__proposals">
            <li v-for="proposal in pendingProposals" :key="proposal.id">
              <strong>{{ proposal.title }}</strong>
              <span>{{ proposal.summary }}</span>
              <span>接受后：{{ describeProposalEffect(proposal) }}</span>
              <div>
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
