import type { Payload } from 'payload'

import type { Deal } from '@/payload-types'

import { buildProductKey } from '@/lib/deals/productKey'
import { isLowestInWindow } from '@/lib/deals/lowest'
import { relId } from '@/lib/relId'

import { isSlug, readCached } from './cache'

/** Tags shared by every read that renders deal data (names of stores and categories included). */
export const DEAL_TAGS = ['deals', 'stores', 'categories']

/**
 * Fetch deals by id in the given order, with store, category and image populated. Runs with
 * `overrideAccess: false`: unpublished and `draft`-lifecycle deals are silently left out, so a
 * drop or event that references one never leaks it. Must be called inside `readCached`.
 */
export async function dealsByIds(payload: Payload, ids: (number | string)[]): Promise<Deal[]> {
  if (ids.length === 0) return []
  const res = await payload.find({
    collection: 'deals',
    where: { id: { in: ids } },
    limit: ids.length,
    depth: 1,
    pagination: false,
    overrideAccess: false,
  })
  const byId = new Map(res.docs.map((d) => [String(d.id), d]))
  return ids.flatMap((id) => {
    const deal = byId.get(String(id))
    return deal ? [deal] : []
  })
}

export async function getDealBySlug(slug: string): Promise<Deal | null> {
  if (!isSlug(slug)) return null
  return readCached(['deal', slug], [`deal:${slug}`, ...DEAL_TAGS], async (payload) => {
    const res = await payload.find({
      collection: 'deals',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 1,
      pagination: false,
      overrideAccess: false,
    })
    return res.docs[0] ?? null
  })
}

/** Live deals of a category, newest first. */
export async function getLiveDealsByCategory(
  categoryId: number,
  categorySlug: string,
  limit = 48,
): Promise<Deal[]> {
  return readCached(
    ['deals-by-category', categorySlug, limit],
    [`category:${categorySlug}`, ...DEAL_TAGS],
    async (payload) => {
      const res = await payload.find({
        collection: 'deals',
        where: { and: [{ category: { equals: categoryId } }, { status: { equals: 'live' } }] },
        sort: '-startsAt',
        limit,
        depth: 1,
        pagination: false,
        overrideAccess: false,
      })
      return res.docs
    },
  )
}

/** Live alternatives in the same category (used by deal pages, especially expired ones). */
export async function getRelatedDeals(
  categoryId: number,
  categorySlug: string,
  excludeId: number,
  limit = 4,
): Promise<Deal[]> {
  return readCached(
    ['related-deals', categorySlug, excludeId, limit],
    [`category:${categorySlug}`, ...DEAL_TAGS],
    async (payload) => {
      const res = await payload.find({
        collection: 'deals',
        where: {
          and: [
            { category: { equals: categoryId } },
            { status: { equals: 'live' } },
            { id: { not_equals: excludeId } },
          ],
        },
        sort: '-startsAt',
        limit,
        depth: 1,
        pagination: false,
        overrideAccess: false,
      })
      return res.docs
    },
  )
}

/**
 * Which of these deals can honestly carry the "Lowest in 90 days" badge (see `isLowestInWindow`).
 * Returns a record keyed by deal id. Only booleans leave this function: price snapshots are
 * staff-only data, read here with `overrideAccess: true`. Revalidated hourly because the 90-day
 * window moves with time; deal edits (which write snapshots) invalidate the `deals` tag.
 */
export async function getLowestFlags(
  deals: Pick<Deal, 'id' | 'store' | 'productUrl' | 'price' | 'currency'>[],
): Promise<Record<string, boolean>> {
  const entries = deals.flatMap((deal) => {
    const storeId = relId(deal.store)
    if (storeId === undefined || !deal.productUrl) return []
    try {
      return [
        {
          id: deal.id,
          key: buildProductKey(storeId, deal.productUrl),
          price: deal.price,
          currency: deal.currency,
        },
      ]
    } catch {
      return []
    }
  })
  if (entries.length === 0) return {}

  return readCached(
    ['lowest', ...entries.map((e) => `${e.id}|${e.key}|${e.price}|${e.currency}`)],
    ['deals'],
    async (payload) => {
      const res = await payload.find({
        collection: 'price-snapshots',
        where: { productKey: { in: [...new Set(entries.map((e) => e.key))] } },
        sort: 'capturedAt',
        limit: 5000,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      const now = new Date()
      const out: Record<string, boolean> = {}
      for (const entry of entries) {
        out[String(entry.id)] = isLowestInWindow({
          currentPrice: entry.price,
          snapshots: res.docs
            .filter((r) => r.productKey === entry.key && r.currency === entry.currency)
            .map((r) => ({ price: r.price, capturedAt: r.capturedAt })),
          now,
        })
      }
      return out
    },
    3600,
  )
}
