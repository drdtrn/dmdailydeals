/**
 * In-memory sliding-window rate limiter. The key (an IP address) lives only in this process's
 * memory, only for the window, and is never written to the database or to a log.
 * One web instance is assumed (see the plan's architecture notes), so memory is enough.
 */
export type RateLimiter = {
  /** Records an attempt for `key`; returns false when the key is over its limit. */
  hit: (key: string, now?: number) => boolean
  /** Test helper. */
  reset: () => void
}

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 10_000,
}: {
  limit: number
  windowMs: number
  maxKeys?: number
}): RateLimiter {
  const hits = new Map<string, number[]>()

  function prune(now: number) {
    for (const [key, times] of hits) {
      const fresh = times.filter((t) => now - t < windowMs)
      if (fresh.length === 0) hits.delete(key)
      else hits.set(key, fresh)
    }
  }

  return {
    hit(key, now = Date.now()) {
      if (hits.size >= maxKeys) prune(now)
      // Still full of distinct live keys (an attack): drop the oldest rather than grow forever.
      if (hits.size >= maxKeys) hits.delete(hits.keys().next().value as string)
      const times = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
      if (times.length >= limit) {
        hits.set(key, times)
        return false
      }
      times.push(now)
      hits.set(key, times)
      return true
    },
    reset: () => hits.clear(),
  }
}

/** 5 signup attempts per IP per 10 minutes. */
export const SUBSCRIBE_RATE_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 }

/**
 * The client IP for rate limiting only. Never store or log the result.
 *
 * 1. `CF-Connecting-IP`: Cloudflare overwrites it on every request. It is only trustworthy when
 *    the origin accepts traffic from Cloudflare alone (Phase 9 locks the origin down); otherwise
 *    a client could send its own value.
 * 2. The RIGHT-most `X-Forwarded-For` entry: our own reverse proxy (Caddy) appends the address it
 *    actually saw as the last hop. Everything to its left is client-supplied and can be rotated
 *    freely to dodge the limit, so the left-most entry must not be used.
 * 3. Otherwise null (no limiting).
 */
export function clientIp(headers: Headers): string | null {
  const cf = headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  const hops = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
  return hops.at(-1) ?? null
}
