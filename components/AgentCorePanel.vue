<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAgentCore, type AgentCore, type AgentCoreProposalAction } from '../composables/useAgentCore'

const props = defineProps<{
  loadCore?: () => Promise<AgentCore | null>
  applyProposal?: (id: string, action: AgentCoreProposalAction) => Promise<boolean>
}>()

const agentCore = useAgentCore()
const open = ref(false)
const loadedCore = ref<AgentCore | null>(null)
const pending = ref(false)
const error = ref('')

const core = computed(() => loadedCore.value)

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
</script>

<template>
  <aside class="agent-core-panel" aria-label="Agent Core">
    <button
      type="button"
      class="agent-core-panel__trigger"
      aria-label="打开 Agent Core"
      :aria-expanded="open"
      @click="openPanel"
    >
      Core
    </button>

    <section v-if="open" class="agent-core-panel__sheet">
      <header>
        <div>
          <p>Agent Core</p>
          <span v-if="core">{{ core.profile.assistantName }} · {{ core.profile.mbti }}</span>
        </div>
        <button type="button" aria-label="关闭 Agent Core" @click="open = false">
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
            反思
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
            提案
          </p>
          <ul v-if="core.pendingProposals.length" class="agent-core-panel__proposals">
            <li v-for="proposal in core.pendingProposals" :key="proposal.id">
              <strong>{{ proposal.title }}</strong>
              <span>{{ proposal.summary }}</span>
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
      </template>
    </section>
  </aside>
</template>
