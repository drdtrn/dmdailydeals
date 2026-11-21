import type { PayloadRequest } from 'payload'

import { revalidatePath, revalidateTag } from 'next/cache'

type Args = {
  req: Pick<PayloadRequest, 'context' | 'payload'>
  tags?: (string | null | undefined | false)[]
  paths?: (string | null | undefined | false)[]
}

/**
 * Invalidate cache tags and paths from a Payload hook.
 *
 * - Skipped entirely when `context.disableRevalidate` is set (seed script, tests, bulk imports).
 * - Every call is wrapped in try/catch: `revalidateTag`/`revalidatePath` throw outside a Next
 *   request context (CLI scripts, some job runs) and a cache miss must never fail a save.
 * - `revalidateTag` takes two arguments in Next 16; `'max'` is stale-while-revalidate.
 */
export const revalidationDisabled = (req: Pick<PayloadRequest, 'context'>): boolean =>
  Boolean(req.context?.disableRevalidate)

/** Outside a Next request (scripts, tests) these calls throw this invariant; that is expected. */
function logSkipped(req: Args['req'], what: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  const expected = message.includes('static generation store missing')
  req.payload.logger[expected ? 'debug' : 'warn'](`${what} skipped: ${message}`)
}

export function revalidate({ req, tags = [], paths = [] }: Args): void {
  if (revalidationDisabled(req)) return

  for (const tag of new Set(tags.filter(Boolean) as string[])) {
    try {
      revalidateTag(tag, 'max')
    } catch (err) {
      logSkipped(req, `revalidateTag("${tag}")`, err)
    }
  }

  for (const path of new Set(paths.filter(Boolean) as string[])) {
    try {
      revalidatePath(path)
    } catch (err) {
      logSkipped(req, `revalidatePath("${path}")`, err)
    }
  }
}
