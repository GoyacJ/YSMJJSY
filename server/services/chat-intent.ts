export type ResolvedChatIntent = 'chat' | 'audio' | 'image' | 'music' | 'video'

export function resolveChatIntent(input: {
  message: string
  forcedIntent?: 'auto' | ResolvedChatIntent
}): ResolvedChatIntent {
  if (input.forcedIntent && input.forcedIntent !== 'auto') {
    return input.forcedIntent
  }

  const rules: Array<{ intent: ResolvedChatIntent, patterns: RegExp[] }> = [
    { intent: 'image', patterns: [/画/, /图片/, /插画/, /海报/, /生成.*图/] },
    { intent: 'music', patterns: [/歌/, /音乐/, /旋律/, /写一首/, /作曲/] },
    { intent: 'video', patterns: [/视频/, /动画/, /短片/, /做一段/] },
    { intent: 'audio', patterns: [/读给我听/, /念给我听/, /听你说/, /语音/] },
  ]

  return rules.find(rule => rule.patterns.some(pattern => pattern.test(input.message)))?.intent ?? 'chat'
}
