import type { AlwaysOnOffer, Category, SiteSetting } from '@/payload-types'

import { getNextDropAt, resolveDropSettings } from '@/lib/drops/time'

import { isSlug, readCached } from './cache'

export async function getSiteSettings(): Promise<SiteSetting> {
  return readCached(['site-settings'], ['site-settings'], (payload) =>
    payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: false }),
  )
}

/** Drop time settings for `getNextDropAt`, merged over the defaults. Never throws on odd data. */
export async function getDropTimeSettings() {
  return resolveDropSettings(await getSiteSettings())
}

/**
 * ISO instant of the next drop, for the countdown. The settings come from the cache, but the clock
 * is read per request, so the target is always current even though the page data is cached.
 */
export async function getNextDropTarget(): Promise<string> {
  return getNextDropAt(new Date(), await getDropTimeSettings()).toISOString()
}

export async function getOffer(): Promise<AlwaysOnOffer> {
  return readCached(['always-on-offer'], ['offer'], (payload) =>
    payload.findGlobal({ slug: 'always-on-offer', depth: 1, overrideAccess: false }),
  )
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  if (!isSlug(slug)) return null
  return readCached(['category', slug], [`category:${slug}`, 'categories'], async (payload) => {
    const res = await payload.find({
      collection: 'categories',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      pagination: false,
      overrideAccess: false,
    })
    return res.docs[0] ?? null
  })
}
