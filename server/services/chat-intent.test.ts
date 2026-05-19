import { describe, expect, it } from 'vitest'
import { resolveChatIntent } from './chat-intent'
import { buildForcedToolCallFromIntent } from './star-chat'

describe('resolveChatIntent', () => {
  it('keeps forced intent', () => {
    expect(resolveChatIntent({ message: '随便聊聊', forcedIntent: 'image' })).toBe('image')
  })

  it('does not route keyword-like messages without an explicit compatibility intent', () => {
    expect(resolveChatIntent({ message: '画一张月光下的信' })).toBe('chat')
    expect(resolveChatIntent({ message: '读给我听' })).toBe('chat')
  })

  it('treats auto as normal chat so the planner can decide', () => {
    expect(resolveChatIntent({ message: '画一张月光下的信', forcedIntent: 'auto' })).toBe('chat')
  })

  it('defaults to chat', () => {
    expect(resolveChatIntent({ message: '今天有点累' })).toBe('chat')
  })

  it('maps compatibility media intents to forced tool calls', () => {
    expect(buildForcedToolCallFromIntent('image', '画一张星空')).toMatchObject({
      toolName: 'star.generateImage',
      input: { prompt: '画一张星空' },
      mode: 'execute',
    })
    expect(buildForcedToolCallFromIntent('music', '写一首歌')?.toolName).toBe('star.generateMusic')
    expect(buildForcedToolCallFromIntent('video', '做一段视频')?.toolName).toBe('star.generateVideo')
    expect(buildForcedToolCallFromIntent('audio', '读给我听', '星信回复')).toMatchObject({
      toolName: 'star.speakReply',
      input: { text: '星信回复' },
    })
  })

  it('does not force tools for chat or auto compatibility intents', () => {
    expect(buildForcedToolCallFromIntent('chat', '随便聊聊')).toBeUndefined()
    expect(buildForcedToolCallFromIntent('auto', '画一张星空')).toBeUndefined()
  })
})
