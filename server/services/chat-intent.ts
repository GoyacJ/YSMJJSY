export type ResolvedChatIntent = 'chat' | 'audio' | 'image' | 'music' | 'video'

export function resolveChatIntent(input: {
  message: string
  forcedIntent?: 'auto' | ResolvedChatIntent
}): ResolvedChatIntent {
  if (input.forcedIntent && input.forcedIntent !== 'auto') {
    return input.forcedIntent
  }

  return 'chat'
}
