/**
 * Builds the outbound (store) URL for `/go/[id]`. Pure: no Payload, no Next, no I/O.
 *
 * - An `active` affiliate store applies its `linkTemplate`; every other store gets the plain
 *   product URL.
 * - `{url}` is replaced with the product URL as is, `{encodedUrl}` with its percent-encoded form
 *   (for network deep links such as `https://track.example.net/deep?u={encodedUrl}`).
 * - The result must be an absolute `http:` or `https:` URL. Anything else (relative, `javascript:`,
 *   `data:`, garbage) yields `null`, so the route never redirects somewhere unsafe.
 */

export type OutboundStore = {
  affiliateStatus?: string | null
  linkTemplate?: string | null
}

/** Returns the normalised absolute http(s) URL, or null if `value` is not one. */
export function parseHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  if (!parsed.hostname) return null
  return parsed.href
}

/** Substitutes the placeholders. Uses replacer functions so `$` in URLs is never interpreted. */
export function applyLinkTemplate(template: string, productUrl: string): string {
  return template
    .replaceAll('{encodedUrl}', () => encodeURIComponent(productUrl))
    .replaceAll('{url}', () => productUrl)
}

/** The plain product URL, validated. Used directly for non-monetised stores. */
export function plainOutboundUrl(productUrl: unknown): string | null {
  return parseHttpUrl(productUrl)
}

/** The URL to redirect to, or null when no safe absolute http(s) URL can be produced. */
export function buildOutboundUrl(productUrl: unknown, store: OutboundStore): string | null {
  const plain = parseHttpUrl(productUrl)
  if (!plain) return null
  if (store.affiliateStatus !== 'active') return plain
  const template = store.linkTemplate?.trim()
  if (!template) return null
  return parseHttpUrl(applyLinkTemplate(template, plain))
}
