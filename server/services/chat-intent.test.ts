import { describe, expect, it } from 'vitest'
import { resolveChatIntent } from './chat-intent'

describe('resolveChatIntent', () => {
  it('keeps forced intent', () => {
    expect(resolveChatIntent({ message: '随便聊聊', forcedIntent: 'image' })).toBe('image')
  })

  it('detects image intent', () => {
    expect(resolveChatIntent({ message: '画一张月光下的信' })).toBe('image')
  })

  it('detects audio intent', () => {
    expect(resolveChatIntent({ message: '读给我听' })).toBe('audio')
  })

  it('defaults to chat', () => {
    expect(resolveChatIntent({ message: '今天有点累' })).toBe('chat')
  })
})
