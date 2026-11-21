/**
 * IndexNow helpers (plan §C). Pure: the task does the fetch.
 *
 * The key is public by design. Serving `https://<site>/<key>.txt` (content = the key) comes in
 * Phase 6 (`public/<INDEXNOW_KEY>.txt` or a route); until then pings are rejected by IndexNow with
 * 403, so leave `INDEXNOW_KEY` unset until that file is deployed.
 */

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
const KEY_RE = /^[a-zA-Z0-9-]{8,128}$/

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
    target: { host: url.host, origin: url.origin, key: k, keyLocation: `${url.origin}/${k}.txt` },
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
