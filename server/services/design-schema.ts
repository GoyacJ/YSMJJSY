import { z } from 'zod'
import type { StarPageDesignSchema } from '../../types/design-schema'

const letterSectionSchema = z.object({
  type: z.literal('letter'),
  text: z.string().trim().min(1).max(600),
  layout: z.enum(['normal', 'moon-wrap', 'date-orbit', 'star-trail']).optional(),
})

const memoryMapSectionSchema = z.object({
  type: z.literal('memory-map'),
  items: z.array(z.object({
    date: z.string().trim().min(1).max(24),
    text: z.string().trim().min(1).max(160),
  })).max(8),
})

const starSceneSectionSchema = z.object({
  type: z.literal('star-scene'),
  density: z.number().min(0).max(1),
  caption: z.string().trim().min(1).max(160),
})

export const starPageDesignSchema = z.object({
  version: z.literal(1),
  theme: z.enum(['star-letter', 'moon-note', 'film-memory']),
  palette: z.enum(['rose-gold', 'midnight', 'paper-moon']),
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().min(1).max(160),
  sections: z.array(z.discriminatedUnion('type', [
    letterSectionSchema,
    memoryMapSectionSchema,
    starSceneSectionSchema,
  ])).min(1).max(8),
})

export function createDefaultDesignSchema(): StarPageDesignSchema {
  return {
    version: 1,
    theme: 'star-letter',
    palette: 'rose-gold',
    title: '给你的信',
    subtitle: '有些话今天认真写给你。',
    sections: [
      {
        type: 'letter',
        layout: 'moon-wrap',
        text: '这里会慢慢写下只属于这把钥匙的内容。',
      },
      {
        type: 'memory-map',
        items: [
          { date: '5.20', text: '今天想把这句话说得正式一点。' },
        ],
      },
      {
        type: 'star-scene',
        density: 0.64,
        caption: '每一颗星都可以被重新设计。',
      },
    ],
  }
}

export function parseDesignSchema(input: unknown): StarPageDesignSchema {
  const result = starPageDesignSchema.safeParse(input)

  if (!result.success) {
    throw new Error('Invalid design schema')
  }

  return result.data
}
