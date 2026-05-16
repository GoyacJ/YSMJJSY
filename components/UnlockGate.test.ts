import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import UnlockGate from './UnlockGate.vue'

describe('UnlockGate', () => {
  it('emits unlocked after successful submit', async () => {
    const wrapper = mount(UnlockGate, {
      props: {
        unlock: async () => ({ ok: true }),
        createKey: async () => ({ ok: true }),
      },
    })

    await wrapper.find('input').setValue('100522')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.find('.unlock-gate__panel').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('给你的信')
    expect(wrapper.emitted('unlocked')?.[0]?.[0]).toEqual({ ok: true })
  })

  it('shows a gentle error after failed submit', async () => {
    const unlock = vi.fn(async () => ({ ok: false }))
    const wrapper = mount(UnlockGate, {
      props: {
        unlock,
        createKey: async () => ({ ok: false }),
      },
    })

    await wrapper.find('input').setValue('000000')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('这不是这封信的钥匙。')
  })

  it('creates a key and emits created', async () => {
    const createKey = vi.fn(async () => ({ ok: true, keyId: 'key_1', needsConfig: true }))
    const wrapper = mount(UnlockGate, {
      props: {
        unlock: async () => ({ ok: false }),
        createKey,
      },
    })

    await wrapper.find('input').setValue('my-key')
    await wrapper.get('button[aria-label="创建钥匙"]').trigger('click')

    expect(createKey).toHaveBeenCalledWith('my-key')
    expect(wrapper.emitted('created')?.[0]?.[0]).toEqual({ ok: true, keyId: 'key_1', needsConfig: true })
  })

  it('requires new keys to be at least six characters', async () => {
    const createKey = vi.fn(async () => ({ ok: true, keyId: 'key_1', needsConfig: true }))
    const wrapper = mount(UnlockGate, {
      props: {
        unlock: async () => ({ ok: false }),
        createKey,
      },
    })

    await wrapper.find('input').setValue('12345')
    await wrapper.get('button[aria-label="创建钥匙"]').trigger('click')

    expect(createKey).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('钥匙至少需要 6 位。')
  })
})
