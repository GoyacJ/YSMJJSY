export type StarPoint = {
  x: number
  y: number
}

type Bounds = {
  width: number
  height: number
}

const digitPatterns: Record<string, string[]> = {
  '5': [
    '111',
    '100',
    '111',
    '001',
    '111',
  ],
  '2': [
    '111',
    '001',
    '111',
    '100',
    '111',
  ],
  '0': [
    '111',
    '101',
    '101',
    '101',
    '111',
  ],
}

export function create520StarPoints(bounds: Bounds): StarPoint[] {
  const cell = Math.min(bounds.width / 18, bounds.height / 8)
  const startX = (bounds.width - cell * 13) / 2
  const startY = (bounds.height - cell * 5) / 2
  const points: StarPoint[] = []

  for (const [digitIndex, digit] of ['5', '2', '0'].entries()) {
    const pattern = digitPatterns[digit]
    const digitOffset = digitIndex * cell * 5

    pattern.forEach((row, rowIndex) => {
      Array.from(row).forEach((value, columnIndex) => {
        if (value !== '1') {
          return
        }

        points.push({
          x: Math.round(startX + digitOffset + columnIndex * cell),
          y: Math.round(startY + rowIndex * cell),
        })
      })
    })
  }

  return points
}
