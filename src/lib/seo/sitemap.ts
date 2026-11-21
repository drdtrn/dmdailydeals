import type { MetadataRoute } from 'next'

import {
  listCategories,
  listSitemapDeals,
  listSitemapDrops,
  listSitemapEvents,
  listSitemapPages,
  listSitemapPosts,
  listSitemapStores,
} from '@/lib/data/seo'
import { getOffer } from '@/lib/data/site'
import { newestUpdatedAt } from '@/lib/freshness'
import { categoryHref } from '@/lib/categories'

import { isEventIndexable, isThinStore } from './indexing'
import { absoluteUrl, siteOrigin } from './site'

/** The child sitemaps. Static on purpose: `generateSitemaps` must not need the database. */
export const SITEMAP_IDS = ['deals', 'drops', 'hubs', 'pages', 'posts'] as const
export type SitemapId = (typeof SITEMAP_IDS)[number]

export function isSitemapId(value: string): value is SitemapId {
  return (SITEMAP_IDS as readonly string[]).includes(value)
}

export const sitemapPath = (id: SitemapId) => `/sitemap/${id}.xml`

/** `lastModified` is the document's `updatedAt`, never "now"; omitted when unknown. */
function entry(url: string, updatedAt: string | null | undefined): MetadataRoute.Sitemap[number] {
  return { url, ...(updatedAt ? { lastModified: new Date(updatedAt) } : {}) }
}

/** The URLs of one child sitemap. Reads Payload, so it only ever runs on a request. */
export async function sitemapEntries(id: SitemapId): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin()
  const url = (path: string) => absoluteUrl(path, origin)

  switch (id) {
    case 'deals': {
      // Expired and sold-out deal pages stay indexable, so they stay in the sitemap.
      const deals = await listSitemapDeals()
      return deals.map((d) => entry(url(`/deal/${d.slug}`), d.updatedAt))
    }

    case 'drops': {
      const drops = await listSitemapDrops()
      return drops.map((d) => entry(url(`/drops/${d.slug}`), d.updatedAt))
    }

    case 'hubs': {
      const [deals, drops, categories, stores, events] = await Promise.all([
        listSitemapDeals(),
        listSitemapDrops(),
        listCategories(),
        listSitemapStores(),
        listSitemapEvents(),
      ])
      const dealsOf = (key: 'storeId' | 'categoryId', id: number | string) =>
        deals.filter((d) => String(d[key]) === String(id))
      const now = new Date()
      return [
        entry(url('/'), newestUpdatedAt(drops.slice(0, 1))),
        entry(url('/drops'), newestUpdatedAt(drops.slice(0, 1))),
        ...categories.map((c) =>
          entry(
            url(categoryHref(c.slug)),
            newestUpdatedAt(dealsOf('categoryId', c.id), c.updatedAt),
          ),
        ),
        // Same rule as the store page's robots meta: fewer than 3 published deals is noindex.
        ...stores.flatMap((s) => {
          const own = dealsOf('storeId', s.id)
          return isThinStore(own.length)
            ? []
            : [entry(url(`/stores/${s.slug}`), newestUpdatedAt(own, s.updatedAt))]
        }),
        // In season, or carrying evergreen copy: the same rule as the event page's robots meta.
        ...events
          .filter((e) => isEventIndexable(e, now))
          .map((e) => entry(url(`/${e.slug}`), e.updatedAt)),
      ]
    }

    case 'pages': {
      const [pages, offer, posts] = await Promise.all([
        listSitemapPages(),
        getOffer(),
        listSitemapPosts(1),
      ])
      return [
        ...pages.map((p) => entry(url(`/${p.slug}`), p.updatedAt)),
        entry(url('/esim'), offer.updatedAt),
        // An empty blog index is a thin page: it joins the sitemap with the first published post.
        ...(posts.length > 0 ? [entry(url('/blog'), newestUpdatedAt(posts))] : []),
      ]
    }

    case 'posts': {
      const posts = await listSitemapPosts()
      return posts.map((p) => entry(url(`/blog/${p.slug}`), p.updatedAt))
    }
  }
}
