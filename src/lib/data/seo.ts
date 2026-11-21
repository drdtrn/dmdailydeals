import type { Category, Deal, Drop, Event, Page, Post, Store } from '@/payload-types'

import { relId } from '@/lib/relId'

import { readCached } from './cache'
import { dealsByIds, DEAL_TAGS } from './deals'

/**
 * Reads for the crawler surfaces (sitemaps, llms.txt, the RSS feed). Like every public read they go
 * through `readCached` with `overrideAccess: false`, so drafts and scheduled drops never leak. The
 * `sitemap` tag is emitted by every collection hook that changes what these list.
 */

/** Google's per-sitemap limit is 50,000 URLs; one sitemap per kind is enough until then. */
const SITEMAP_LIMIT = 50_000

export type SitemapDeal = {
  slug: string
  updatedAt: string
  status: Deal['status']
  storeId: number | string | undefined
  categoryId: number | string | undefined
}

/** Every publicly visible deal (live, expired, sold out): each keeps an indexable page. */
export async function listSitemapDeals(): Promise<SitemapDeal[]> {
  return readCached(['sitemap-deals'], ['sitemap', ...DEAL_TAGS], async (payload) => {
    const res = await payload.find({
      collection: 'deals',
      depth: 0,
      limit: SITEMAP_LIMIT,
      pagination: false,
      sort: '-updatedAt',
      overrideAccess: false,
      select: { slug: true, updatedAt: true, status: true, store: true, category: true },
    })
    return res.docs.map((d) => ({
      slug: d.slug,
      updatedAt: d.updatedAt,
      status: d.status,
      storeId: relId(d.store),
      categoryId: relId(d.category),
    }))
  })
}

export type SitemapDrop = Pick<Drop, 'slug' | 'updatedAt'>

/** Live and archived drops (access hides scheduled ones). */
export async function listSitemapDrops(): Promise<SitemapDrop[]> {
  return readCached(['sitemap-drops'], ['sitemap', 'drops'], async (payload) => {
    const res = await payload.find({
      collection: 'drops',
      depth: 0,
      limit: SITEMAP_LIMIT,
      pagination: false,
      sort: '-date',
      overrideAccess: false,
      select: { slug: true, updatedAt: true },
    })
    return res.docs
  })
}

export type SitemapCategory = Pick<Category, 'id' | 'slug' | 'title' | 'updatedAt'>

export async function listCategories(): Promise<SitemapCategory[]> {
  return readCached(['categories-list'], ['sitemap', 'categories'], async (payload) => {
    const res = await payload.find({
      collection: 'categories',
      depth: 0,
      limit: 100,
      pagination: false,
      sort: 'title',
      overrideAccess: false,
      select: { slug: true, title: true, updatedAt: true },
    })
    return res.docs as SitemapCategory[]
  })
}

export type SitemapStore = Pick<Store, 'id' | 'slug' | 'updatedAt'>

export async function listSitemapStores(): Promise<SitemapStore[]> {
  return readCached(['sitemap-stores'], ['sitemap', 'stores'], async (payload) => {
    const res = await payload.find({
      collection: 'stores',
      depth: 0,
      limit: SITEMAP_LIMIT,
      pagination: false,
      overrideAccess: false,
      select: { slug: true, updatedAt: true },
    })
    return res.docs as SitemapStore[]
  })
}

export type SitemapEvent = Pick<Event, 'slug' | 'updatedAt' | 'startsAt' | 'endsAt' | 'intro'>

export async function listSitemapEvents(): Promise<SitemapEvent[]> {
  return readCached(['sitemap-events'], ['sitemap', 'events'], async (payload) => {
    const res = await payload.find({
      collection: 'events',
      depth: 0,
      limit: SITEMAP_LIMIT,
      pagination: false,
      draft: false,
      overrideAccess: false,
      select: { slug: true, updatedAt: true, startsAt: true, endsAt: true, intro: true },
    })
    return res.docs as SitemapEvent[]
  })
}

export type SitemapPage = Pick<Page, 'slug' | 'updatedAt'>

export async function listSitemapPages(): Promise<SitemapPage[]> {
  return readCached(['sitemap-pages'], ['sitemap', 'pages-sitemap'], async (payload) => {
    const res = await payload.find({
      collection: 'pages',
      depth: 0,
      limit: SITEMAP_LIMIT,
      pagination: false,
      draft: false,
      overrideAccess: false,
      select: { slug: true, updatedAt: true },
    })
    return res.docs as SitemapPage[]
  })
}

export type SitemapPost = Pick<Post, 'slug' | 'title' | 'updatedAt' | 'publishedAt'>

/** Published posts, newest first. */
export async function listSitemapPosts(limit = SITEMAP_LIMIT): Promise<SitemapPost[]> {
  return readCached(
    ['sitemap-posts', limit],
    ['sitemap', 'posts', 'posts-sitemap'],
    async (payload) => {
      const res = await payload.find({
        collection: 'posts',
        depth: 0,
        limit,
        pagination: false,
        sort: '-publishedAt',
        draft: false,
        overrideAccess: false,
        select: { slug: true, title: true, updatedAt: true, publishedAt: true },
      })
      return res.docs as SitemapPost[]
    },
  )
}

export type FeedDrop = {
  slug: string
  date: string
  publishAt: string
  updatedAt: string
  intro: string | null
  hero: Pick<Deal, 'title' | 'price' | 'currency' | 'slug'> | null
  picks: Pick<Deal, 'title' | 'price' | 'currency' | 'slug'>[]
}

type DealStub = Pick<Deal, 'title' | 'price' | 'currency' | 'slug'>

/** The newest live and archived drops with their hero and pick titles (RSS feed, llms.txt). */
export async function listFeedDrops(limit = 20): Promise<FeedDrop[]> {
  return readCached(['feed-drops', limit], ['sitemap', 'drops', ...DEAL_TAGS], async (payload) => {
    const res = await payload.find({
      collection: 'drops',
      depth: 0,
      limit,
      pagination: false,
      sort: '-date',
      overrideAccess: false,
    })
    const ids = new Set<string>()
    for (const drop of res.docs) {
      for (const ref of [drop.hero, ...(drop.picks ?? [])]) {
        const id = relId(ref)
        if (id !== undefined) ids.add(String(id))
      }
    }
    const deals = await dealsByIds(payload, [...ids].map(Number))
    const byId = new Map<string, DealStub>(
      deals.map((d) => [
        String(d.id),
        { title: d.title, price: d.price, currency: d.currency, slug: d.slug },
      ]),
    )
    const lookup = (ref: unknown) => byId.get(String(relId(ref))) ?? null
    return res.docs.map((drop) => ({
      slug: drop.slug ?? drop.date.slice(0, 10),
      date: drop.date,
      publishAt: drop.publishAt ?? drop.date,
      updatedAt: drop.updatedAt,
      intro: drop.intro ?? null,
      hero: lookup(drop.hero),
      picks: (drop.picks ?? []).flatMap((ref) => {
        const deal = lookup(ref)
        return deal ? [deal] : []
      }),
    }))
  })
}
