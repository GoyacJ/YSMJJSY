export function isValidUnlockCode(input: string, expected: string) {
  return input.trim() === expected
}

export function getSessionCookieName() {
  return 'letter_session'
}

export function createSessionToken(sessionSecret: string) {
  return sessionSecret ? `unlocked.${sessionSecret.slice(0, 12)}` : 'unlocked'
}

export function isValidSessionToken(token: string | undefined, sessionSecret: string) {
  return token === createSessionToken(sessionSecret)
}
