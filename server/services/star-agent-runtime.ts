import { createDefaultAgentProviderRegistry } from './agent-providers'
import type { AgentToolRegistry } from './agent-runtime'
import { getDefaultMusicPrompt, normalizeMediaPrompt } from './media'
import { createMiniMaxClient } from './minimax'
import { registerStarAgentTools, type StarAgentToolContext } from './star-agent-tools'

export function registerDefaultStarAgentTools(
  registry: AgentToolRegistry,
  input: StarAgentToolContext & {
    minimaxApiKey: string
    minimaxGroupId?: string
  },
) {
  const providerRegistry = createDefaultAgentProviderRegistry({
    minimaxApiKey: input.minimaxApiKey,
    minimaxGroupId: input.minimaxGroupId,
  })
  const mediaClient = createMiniMaxClient({
    apiKey: input.minimaxApiKey,
    groupId: input.minimaxGroupId,
  })

  registerStarAgentTools(registry, {
    ...input,
    provider: input.provider ?? providerRegistry.getDefault(),
    media: {
      generateImage: input.media?.generateImage ?? (prompt => mediaClient.generateImage(normalizeMediaPrompt(prompt))),
      generateMusic: input.media?.generateMusic ?? (prompt => mediaClient.generateMusic(prompt || getDefaultMusicPrompt())),
      createVideoTask: input.media?.createVideoTask ?? (prompt => mediaClient.createVideoTask(normalizeMediaPrompt(prompt))),
    },
    reply: {
      speak: input.reply?.speak ?? (text => mediaClient.textToSpeech(text)),
    },
  })
}
