import type { Deal, Event, Page, Post, Store } from '@/payload-types'

import { totalPagesFor } from '@/lib/pagination'

import { DEAL_TAGS, dealsByIds } from './deals'
import { isSlug, readCached } from './cache'

// --- Stores -------------------------------------------------------------------------------------

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  if (!isSlug(slug)) return null
  return readCached(['store', slug], [`store:${slug}`, 'stores'], async (payload) => {
    const res = await payload.find({
      collection: 'stores',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 1,
      pagination: false,
      overrideAccess: false,
    })
    return res.docs[0] ?? null
  })
}

/**
 * A store's published deals: the live ones, then recent expired and sold-out ones. `total` counts
 * every publicly visible deal, so the hub page can 404 for stores with nothing to show.
 */
export async function getStoreDeals(
  storeId: number,
  storeSlug: string,
): Promise<{ live: Deal[]; recent: Deal[]; total: number }> {
  return readCached(
    ['store-deals', storeSlug],
    [`store:${storeSlug}`, ...DEAL_TAGS],
    async (payload) => {
      const base = {
        collection: 'deals' as const,
        depth: 1,
        pagination: false as const,
        overrideAccess: false,
      }
      const [live, recent, all] = await Promise.all([
        payload.find({
          ...base,
          where: { and: [{ store: { equals: storeId } }, { status: { equals: 'live' } }] },
          sort: '-startsAt',
          limit: 48,
        }),
        payload.find({
          ...base,
          where: {
            and: [{ store: { equals: storeId } }, { status: { in: ['expired', 'sold-out'] } }],
          },
          sort: '-expiresAt',
          limit: 8,
        }),
        payload.count({
          collection: 'deals',
          where: { store: { equals: storeId } },
          overrideAccess: false,
        }),
      ])
      return { live: live.docs, recent: recent.docs, total: all.totalDocs }
    },
  )
}

// --- Pages and events ----------------------------------------------------------------------------

export async function getPageBySlug(slug: string): Promise<Page | null> {
  if (!isSlug(slug)) return null
  return readCached(['page', slug], [`page:${slug}`], async (payload) => {
    const res = await payload.find({
      collection: 'pages',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 2,
      pagination: false,
      draft: false,
      overrideAccess: false,
    })
    return res.docs[0] ?? null
  })
}

export async function getEventBySlug(
  slug: string,
): Promise<{ event: Event; deals: Deal[] } | null> {
  if (!isSlug(slug)) return null
  return readCached(['event', slug], [`event:${slug}`, 'events', ...DEAL_TAGS], async (payload) => {
    const res = await payload.find({
      collection: 'events',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 1,
      pagination: false,
      draft: false,
      overrideAccess: false,
    })
    const event = res.docs[0]
    if (!event) return null
    const ids = (event.deals ?? []).map((d) => (typeof d === 'object' ? d.id : d))
    return { event, deals: await dealsByIds(payload, ids) }
  })
}

// --- Blog ----------------------------------------------------------------------------------------

export const POSTS_PER_PAGE = 12

export type PostCard = Pick<Post, 'id' | 'slug' | 'title' | 'categories' | 'meta'>

export async function listPosts(page: number): Promise<{
  docs: PostCard[]
  totalDocs: number
  totalPages: number
  page: number
}> {
  return readCached(['posts-list', page], ['posts'], async (payload) => {
    const res = await payload.find({
      collection: 'posts',
      depth: 1,
      limit: POSTS_PER_PAGE,
      page,
      sort: '-publishedAt',
      overrideAccess: false,
      select: { title: true, slug: true, categories: true, meta: true },
    })
    return {
      docs: res.docs as PostCard[],
      totalDocs: res.totalDocs,
      totalPages: totalPagesFor(res.totalDocs, POSTS_PER_PAGE),
      page: res.page ?? page,
    }
  })
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  if (!isSlug(slug)) return null
  return readCached(['post', slug], [`post:${slug}`, 'posts'], async (payload) => {
    const res = await payload.find({
      collection: 'posts',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 2,
      pagination: false,
      draft: false,
      overrideAccess: false,
    })
    return res.docs[0] ?? null
  })
}
