export type GeneratedContentDisclosure = {
  aiGenerated: true
  explicitLabel: string
  provider?: string
  generatedAt: string
  sourceWorkId?: string
}

export type StarPageDesignSchema = {
  version: 1
  theme: 'star-letter' | 'moon-note' | 'film-memory'
  palette: 'rose-gold' | 'midnight' | 'paper-moon'
  title: string
  subtitle: string
  disclosure?: GeneratedContentDisclosure
  sections: Array<
    | { type: 'letter', text: string, layout?: 'normal' | 'moon-wrap' | 'date-orbit' | 'star-trail' }
    | { type: 'memory-map', items: Array<{ date: string, text: string }> }
    | { type: 'star-scene', density: number, caption: string }
  >
}
