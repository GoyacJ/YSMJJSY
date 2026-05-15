export const usageLimits = {
  createPerIpPerDay: 5,
  createPerIpPerMinute: 1,
  chatPerKeyPerDay: 80,
  designPerKeyPerDay: 20,
  uploadPerKeyPerDay: 40,
} as const

export function assertWithinLimit(input: { current: number, max: number }) {
  return input.current < input.max
}
