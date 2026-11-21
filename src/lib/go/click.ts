/**
 * Pure helpers that turn a `/go/[id]` request into the fields of a `clicks` row.
 * PRIVACY: nothing here reads or returns an IP address or the user agent string.
 */

const MAX_PATH = 300
const MAX_UTM = 200

const UTM_KEYS = ['source', 'medium', 'campaign', 'content', 'term'] as const
export type ClickUtm = Partial<Record<(typeof UTM_KEYS)[number], string>>

/**
 * The path (no query, no fragment, no host) of `referer`, but only when it is on one of
 * `allowedOrigins` (our own site). Anything else, or anything unparsable, gives undefined.
 */
export function sameOriginPath(
  referer: string | null | undefined,
  allowedOrigins: (string | null | undefined)[],
): string | undefined {
  if (!referer) return undefined
  let url: URL
  try {
    url = new URL(referer)
  } catch {
    return undefined
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
  const allowed = allowedOrigins
    .map((o) => {
      try {
        return o ? new URL(o).origin : null
      } catch {
        return null
      }
    })
    .filter(Boolean)
  if (!allowed.includes(url.origin)) return undefined
  return url.pathname.slice(0, MAX_PATH) || '/'
}

/** `utm_*` values from the `/go` request's own query string. Empty and missing values are dropped. */
export function utmFromSearchParams(params: URLSearchParams): ClickUtm {
  const utm: ClickUtm = {}
  for (const key of UTM_KEYS) {
    const value = params.get(`utm_${key}`)?.trim()
    if (value) utm[key] = value.slice(0, MAX_UTM)
  }
  return utm
}

/** Two-letter ISO country from `CF-IPCountry`. Cloudflare's "XX" (unknown) and "T1" (Tor) give undefined. */
export function countryFromHeader(value: string | null | undefined): string | undefined {
  const code = value?.trim().toUpperCase()
  if (!code || !/^[A-Z]{2}$/.test(code) || code === 'XX') return undefined
  return code
}
