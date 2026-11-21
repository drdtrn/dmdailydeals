/**
 * Product-key helpers for price history. Pure functions: no Payload, no I/O.
 *
 * The key is `<storeId>|<normalised product URL>` so the same product reached through
 * different tracking links maps to one price history.
 */

/** Query parameters that only carry tracking/attribution and never identify the product. */
const TRACKING_PARAMS = new Set([
  'gclid',
  'gbraid',
  'wbraid',
  'dclid',
  'fbclid',
  'msclkid',
  'yclid',
  'twclid',
  'ttclid',
  'igshid',
  'ref',
  'ref_',
  'referrer',
  '_hsenc',
  '_hsmi',
  'mc_cid',
  'mc_eid',
  // Amazon
  'tag',
  'linkcode',
  'linkid',
  'ascsubtag',
  'creative',
  'creativeasin',
  'camp',
  'content-id',
  // eBay
  'mkcid',
  'mkrid',
  'mkevt',
  'campid',
  'customid',
  'toolid',
  'siteid',
  '_trkparms',
  // AliExpress and affiliate networks
  'spm',
  'scm',
  'sk',
  'terminal_id',
  'afsmartredirect',
  'irclickid',
  'irgwc',
  'clickid',
  'awc',
])

const TRACKING_PREFIXES = ['utm_', 'pd_rd_', 'pf_rd_', 'aff_', 'icep_']

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase()
  return TRACKING_PARAMS.has(lower) || TRACKING_PREFIXES.some((p) => lower.startsWith(p))
}

/**
 * Normalise a product URL: lowercase host, no scheme, no hash, no tracking params, no trailing
 * slash, remaining query params sorted. Throws a TypeError for input that is not an http(s) URL.
 */
export function normaliseProductUrl(input: string): string {
  const url = new URL(input.trim())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TypeError(`Not an http(s) URL: ${input}`)
  }

  const kept: [string, string][] = []
  url.searchParams.forEach((value, name) => {
    if (!isTrackingParam(name)) kept.push([name, value])
  })
  kept.sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)))

  const path = url.pathname.replace(/\/+$/, '')
  const query = kept.length
    ? `?${kept.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`
    : ''

  // `URL` already lowercases the host and drops default ports.
  return `${url.host}${path}${query}`
}

export function buildProductKey(storeId: number | string, productUrl: string): string {
  return `${storeId}|${normaliseProductUrl(productUrl)}`
}
