export function getLetterCsrfToken() {
  if (typeof document === 'undefined') {
    return ''
  }

  const cookie = document.cookie
    .split('; ')
    .find(item => item.startsWith('letter_csrf='))

  return cookie ? decodeURIComponent(cookie.slice('letter_csrf='.length)) : ''
}

export function withCsrfHeaders(headers: HeadersInit = {}) {
  const token = getLetterCsrfToken()

  return {
    ...headers,
    ...(token ? { 'x-letter-csrf': token } : {}),
  }
}
