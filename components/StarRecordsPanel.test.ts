import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StarRecordsPanel from './StarRecordsPanel.vue'

describe('StarRecordsPanel', () => {
  it('expands organizing report details without raw payloads', async () => {
    const wrapper = mount(StarRecordsPanel, {
      props: {
        os: {
          agent: {
            id: 'agent_1',
            status: 'active',
            ownerType: 'key',
            ownerId: 'key_1',
            domain: 'star',
          },
          inbox: [],
          tasks: [],
          events: [],
          records: [
            {
              id: 'record_1',
              type: '整理',
              title: '整理报告',
              summary: '整理完成。',
              status: '完成',
              createdAt: '2026-05-19T00:00:00.000Z',
              details: {
                sections: [
                  { title: '新记忆', items: ['用户喜欢短句。'] },
                  { title: '行动建议', items: ['下次回复更短。'] },
                ],
              },
            },
          ],
        },
      },
    })

    await wrapper.get('button[aria-label="展开整理报告"]').trigger('click')

    expect(wrapper.text()).toContain('新记忆')
    expect(wrapper.text()).toContain('用户喜欢短句。')
    expect(wrapper.text()).toContain('行动建议')
    expect(wrapper.text()).not.toContain('payloadJson')
    expect(wrapper.text()).not.toContain('rawProviderBody')
  })
})
