export type LetterParagraph = {
  id: string
  text: string
  layout?: 'normal' | 'heart-wrap' | 'date-wrap' | 'photo-wrap'
}

export type MemoryMoment = {
  id: string
  date: string
  text: string
  image?: string
}

export const letterParagraphs: LetterParagraph[] = [
  {
    id: 'opening',
    text: '有些话放在心里很久，今天想认真写给你。',
    layout: 'normal',
  },
  {
    id: 'quiet',
    text: '喜欢不是突然发生的，是很多个很小的瞬间，慢慢有了方向。',
    layout: 'heart-wrap',
  },
  {
    id: 'ordinary-days',
    text: '想到你时，很多普通的日子会变得柔软一点。',
    layout: 'date-wrap',
  },
  {
    id: 'promise',
    text: '如果可以，我想把之后很多个平常日子，都认真留给你。',
    layout: 'normal',
  },
]

export const memoryMoments: MemoryMoment[] = [
  {
    id: 'first',
    date: '某一天',
    text: '第一次发现自己会期待你的消息。',
  },
  {
    id: 'smile',
    date: '某个瞬间',
    text: '你笑起来的时候，世界会安静一点。',
  },
  {
    id: 'today',
    date: '5.20',
    text: '今天想把这句话说得正式一点。',
  },
]

export const finalConfession = {
  title: '我喜欢你',
  subtitle: '不是今天才开始，只是今天想认真告诉你。',
  cta: '一起吃顿饭吗',
}
