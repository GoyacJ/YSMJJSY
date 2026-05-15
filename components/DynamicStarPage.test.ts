import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DynamicStarPage from './DynamicStarPage.vue'

describe('DynamicStarPage', () => {
  it('renders known schema sections', () => {
    const wrapper = mount(DynamicStarPage, {
      props: {
        schema: {
          version: 1,
          theme: 'star-letter',
          palette: 'rose-gold',
          title: '给你的信',
          subtitle: '今天认真写给你。',
          sections: [
            { type: 'letter', text: '第一段话。', layout: 'normal' },
            { type: 'memory-map', items: [{ date: '5.20', text: '认真说一句。' }] },
            { type: 'star-scene', density: 0.7, caption: '星光在这里。' },
          ],
        },
      },
      global: {
        stubs: {
          ClientOnly: { template: '<div><slot /></div>' },
          PretextParagraph: { props: ['paragraph'], template: '<p>{{ paragraph.text }}</p>' },
        },
      },
    })

    expect(wrapper.text()).toContain('给你的信')
    expect(wrapper.text()).toContain('第一段话。')
    expect(wrapper.text()).toContain('认真说一句。')
    expect(wrapper.text()).toContain('星光在这里。')
  })
})
