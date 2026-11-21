/**
 * Cache tags to invalidate when a drop goes live (see the URL map in the plan). Pure.
 */

export type TagDeal = {
  id: number | string
  categorySlug?: string | null
  storeSlug?: string | null
}

export function collectDropTags({
  dropSlug,
  liveDeals = [],
  expiredDeals = [],
}: {
  /** Slug (`YYYY-MM-DD`) of the drop that just went live, if any. */
  dropSlug?: string | null
  /** The hero and picks of that drop: their category and store hubs change. */
  liveDeals?: TagDeal[]
  /** Deals that just expired: their page, category and store hubs change. */
  expiredDeals?: TagDeal[]
}): string[] {
  const tags = new Set<string>(['drop:current', 'drops', 'sitemap'])
  if (dropSlug) tags.add(`drop:${dropSlug}`)
  for (const deal of [...liveDeals, ...expiredDeals]) {
    if (deal.categorySlug) tags.add(`category:${deal.categorySlug}`)
    if (deal.storeSlug) tags.add(`store:${deal.storeSlug}`)
  }
  for (const deal of expiredDeals) tags.add(`deal:${deal.id}`)
  return [...tags]
}

/** Paths to warm after invalidation. */
export function dropWarmPaths(dropSlug?: string | null): string[] {
  return dropSlug ? ['/', `/drops/${dropSlug}`] : ['/']
}
