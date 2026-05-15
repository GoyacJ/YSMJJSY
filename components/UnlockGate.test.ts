import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import UnlockGate from './UnlockGate.vue'

describe('UnlockGate', () => {
  it('emits unlocked after successful submit', async () => {
    const wrapper = mount(UnlockGate, {
      props: {
        unlock: async () => ({ ok: true }),
      },
    })

    await wrapper.find('input').setValue('100522')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.find('.unlock-gate__envelope').exists()).toBe(true)
    expect(wrapper.emitted('unlocked')).toBeTruthy()
  })

  it('shows a gentle error after failed submit', async () => {
    const unlock = vi.fn(async () => ({ ok: false }))
    const wrapper = mount(UnlockGate, {
      props: { unlock },
    })

    await wrapper.find('input').setValue('000000')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('这不是这封信的钥匙。')
  })
})
