import type { PayloadRequest, TaskConfig } from 'payload'

import { revalidateTag } from 'next/cache'

import type { Deal, Drop } from '../payload-types'

import { collectDropTags, dropWarmPaths, type TagDeal } from '../lib/drops/tags'
import { relId } from '../lib/relId'
import { slugOf } from '../lib/slugOf'

/** Where the job calls the app itself. In production the job runs inside the web container. */
export function internalServerUrl(): string {
  return (
    process.env.INTERNAL_SERVER_URL || `http://127.0.0.1:${process.env.PORT ?? 3000}`
  ).replace(/\/+$/, '')
}

async function toTagDeal(req: PayloadRequest, deal: Deal | number | string): Promise<TagDeal> {
  const full =
    typeof deal === 'object'
      ? deal
      : ((await req.payload
          .findByID({
            collection: 'deals',
            id: deal,
            depth: 0,
            overrideAccess: true,
            req,
          })
          .catch(() => null)) as Deal | null)
  if (!full) return { id: typeof deal === 'object' ? deal.id : deal }
  const [categorySlug, storeSlug] = await Promise.all([
    slugOf(req, 'categories', relId(full.category)),
    slugOf(req, 'stores', relId(full.store)),
  ])
  return { id: full.id, slug: full.slug, categorySlug, storeSlug }
}

/** A failed warm-up never fails the job: the pages simply regenerate on the next real request. */
async function warm(req: PayloadRequest, base: string, path: string): Promise<void> {
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { 'user-agent': 'dmdailydeals-cache-warmer' },
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
    await res.arrayBuffer().catch(() => undefined)
    req.payload.logger.info(`revalidateDrop: warmed ${path} -> ${res.status}`)
  } catch (err) {
    req.payload.logger.warn({ err, msg: `revalidateDrop: could not warm ${path}` })
  }
}

/**
 * Invalidates the cache tags a new drop touches, then warms the key pages.
 *
 * Uses `{ expire: 0 }` (not `'max'`): the warm-up request must regenerate the page from fresh
 * data, not receive the stale copy. `revalidateTag` works because this runs through
 * `GET /api/payload-jobs/run`, i.e. inside a Next request (Phase 1 spike). A `revalidateTag`
 * failure fails the job so it is retried; only the warm-up is best-effort.
 */
export const revalidateDrop: TaskConfig<'revalidateDrop'> = {
  slug: 'revalidateDrop',
  label: 'Revalidate pages after a drop',
  retries: { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
  inputSchema: [
    { name: 'dropId', type: 'number' },
    { name: 'expiredDealIds', type: 'json' },
  ],
  outputSchema: [
    { name: 'tags', type: 'json' },
    { name: 'warmed', type: 'json' },
  ],
  handler: async ({ input, req }) => {
    let drop: Drop | null = null
    if (input.dropId !== undefined && input.dropId !== null) {
      drop = await req.payload.findByID({
        collection: 'drops',
        id: input.dropId,
        depth: 1,
        overrideAccess: true,
        req,
      })
    }

    const liveRefs = drop ? [drop.hero, ...(drop.picks ?? [])] : []
    const expiredRefs = Array.isArray(input.expiredDealIds)
      ? (input.expiredDealIds as (number | string)[])
      : []

    const [liveDeals, expiredDeals] = await Promise.all([
      Promise.all(liveRefs.map((d) => toTagDeal(req, d))),
      Promise.all(expiredRefs.map((d) => toTagDeal(req, d))),
    ])

    const tags = collectDropTags({ dropSlug: drop?.slug, liveDeals, expiredDeals })
    for (const tag of tags) revalidateTag(tag, { expire: 0 })

    const base = internalServerUrl()
    const paths = dropWarmPaths(drop?.slug)
    for (const path of paths) await warm(req, base, path)

    return { output: { tags, warmed: paths } }
  },
}
