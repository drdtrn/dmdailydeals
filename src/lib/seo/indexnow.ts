/**
 * IndexNow helpers (plan §C). Pure: the task does the fetch.
 *
 * The key is public by design and comes from `INDEXNOW_KEY`, so no key file is committed. The key
 * file is served by `app/indexnow-key.txt/route.ts` at `/indexnow-key.txt` (content = the key), and
 * every ping sends that URL as `keyLocation` (IndexNow allows a custom location on the same host;
 * at the site root it covers every URL we submit).
 */

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
const KEY_RE = /^[a-zA-Z0-9-]{8,128}$/

/** Where the key file is served. */
export const INDEXNOW_KEY_PATH = '/indexnow-key.txt'

/** Valid IndexNow keys are 8-128 characters of a-z, A-Z, 0-9 and "-". */
export function isValidIndexNowKey(key: string | undefined | null): key is string {
  return typeof key === 'string' && KEY_RE.test(key.trim())
}

/** The body of the key file: the trimmed key, or null when unset or invalid (the route 404s). */
export function indexNowKeyFile(key: string | undefined | null): string | null {
  return isValidIndexNowKey(key) ? key.trim() : null
}

export function isLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h === '::' ||
    /^127\./.test(h)
  )
}

export type IndexNowTarget = { host: string; origin: string; key: string; keyLocation: string }

/**
 * The target to ping, or a reason for not pinging. Never pings without a valid key or from a
 * local/unset site URL, so dev and CI never submit anything.
 */
export function resolveIndexNowTarget(
  siteUrl: string | undefined,
  key: string | undefined,
): { target: IndexNowTarget } | { skip: string } {
  if (!key?.trim()) return { skip: 'INDEXNOW_KEY is not set' }
  if (!KEY_RE.test(key.trim())) return { skip: 'INDEXNOW_KEY is not 8-128 chars of a-zA-Z0-9-' }
  if (!siteUrl) return { skip: 'NEXT_PUBLIC_SERVER_URL is not set' }
  let url: URL
  try {
    url = new URL(siteUrl)
  } catch {
    return { skip: 'NEXT_PUBLIC_SERVER_URL is not a valid URL' }
  }
  if (isLocalHost(url.hostname)) return { skip: 'site URL is local' }
  const k = key.trim()
  return {
    target: {
      host: url.host,
      origin: url.origin,
      key: k,
      keyLocation: `${url.origin}${INDEXNOW_KEY_PATH}`,
    },
  }
}

/** `/`, the drop page, the archive and the deals in the drop. Deduplicated, absolute. */
export function buildIndexNowUrls(
  origin: string,
  dropSlug: string,
  dealSlugs: (string | null | undefined)[],
): string[] {
  const paths = [
    '/',
    `/drops/${dropSlug}`,
    '/drops',
    ...dealSlugs.filter(Boolean).map((s) => `/deal/${s}`),
  ]
  return [...new Set(paths)].map((p) => `${origin}${p}`)
}
