export const THEME_COOKIE = 'dm-theme'

export type Theme = 'light' | 'dark'

/** A saved choice from the cookie value, or undefined (light, the default). Anything else is ignored. */
export function parseTheme(value: string | undefined | null): Theme | undefined {
  return value === 'light' || value === 'dark' ? value : undefined
}

/**
 * The cookie that remembers the choice. It is read by the root layout on the server, which writes
 * <html data-theme> into the HTML itself: no inline script, so nothing to flash and nothing for
 * React to warn about when it re-renders the document (404 pages).
 */
export function themeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`
}
