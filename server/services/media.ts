export function normalizeMediaPrompt(prompt: string) {
  return [
    prompt.trim(),
    '风格约束：温柔、安静、信纸、星空、浅金光、不过度梦幻、不要夸张爱心元素。',
  ].join('\n')
}

export function getDefaultMusicPrompt() {
  return '温柔、钢琴、轻弦乐、星空、慢速、无强鼓点，适合一封安静的 520 信。'
}

export function toVideoTaskStatus(status: string): 'pending' | 'processing' | 'succeeded' | 'failed' {
  const normalized = status.toLowerCase()

  if (['success', 'succeeded', 'done', 'completed'].includes(normalized)) {
    return 'succeeded'
  }

  if (['fail', 'failed', 'error'].includes(normalized)) {
    return 'failed'
  }

  if (['processing', 'running'].includes(normalized)) {
    return 'processing'
  }

  return 'pending'
}
