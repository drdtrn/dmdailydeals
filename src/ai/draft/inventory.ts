import type { Payload } from 'payload'

import { relId } from '../../lib/relId'
import type { BlogBrief } from '../../payload-types'
import type { InventoryItem } from './validate'

const MAX_DEALS = 60
const MAX_DROPS = 5
const MAX_POSTS = 50

/**
 * The site's link inventory: the only internal pages a draft may link to. URLs are root-relative
 * ("/deal/some-slug"), the same form the saved post stores, so the links keep working when the
 * domain changes. Everything is read the way an anonymous visitor would read it
 * (`overrideAccess: false`, no user): unpublished and hidden pages never appear.
 */
export async function loadLinkInventory(payload: Payload): Promise<InventoryItem[]> {
  const [deals, categories, drops, posts] = await Promise.all([
    payload.find({
      collection: 'deals',
      where: { status: { equals: 'live' } },
      sort: '-startsAt',
      limit: MAX_DEALS,
      depth: 1,
      pagination: false,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'categories',
      limit: 20,
      depth: 0,
      pagination: false,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'drops',
      where: { status: { in: ['live', 'archived'] } },
      sort: '-publishAt',
      limit: MAX_DROPS,
      depth: 0,
      pagination: false,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'posts',
      sort: '-publishedAt',
      limit: MAX_POSTS,
      depth: 0,
      pagination: false,
      draft: false,
      overrideAccess: false,
      select: { title: true, slug: true },
    }),
  ])

  const items: InventoryItem[] = []
  for (const category of categories.docs) {
    if (category.slug) {
      items.push({
        url: `/deals/${category.slug}`,
        label: `${category.title} deals (hub)`,
        kind: 'category',
      })
    }
  }
  for (const deal of deals.docs) {
    if (!deal.slug) continue
    const store = typeof deal.store === 'object' ? deal.store.name : null
    items.push({
      url: `/deal/${deal.slug}`,
      label: `${deal.title}${store ? ` (${store})` : ''}, $${deal.price}`,
      kind: 'deal',
      id: deal.id,
    })
  }
  for (const drop of drops.docs) {
    items.push({ url: `/drops/${drop.slug}`, label: `Drop of ${drop.slug}`, kind: 'drop' })
  }
  items.push(
    { url: '/drops', label: 'All drops (archive)', kind: 'page' },
    { url: '/esim', label: 'Travel eSIM offer', kind: 'page' },
    { url: '/blog', label: 'Blog index', kind: 'page' },
  )
  for (const post of posts.docs) {
    if (post.slug) items.push({ url: `/blog/${post.slug}`, label: post.title, kind: 'post' })
  }
  return items
}

/**
 * The brief's required links as root-relative URLs, resolved from its `mustLinkTo` relations.
 * A deal that is not public (draft) or a missing doc is skipped, so a stale relation cannot make
 * the draft impossible to write.
 */
export async function resolveMustLinkUrls(
  payload: Payload,
  brief: Pick<BlogBrief, 'mustLinkTo'>,
): Promise<string[]> {
  const urls: string[] = []
  for (const ref of brief.mustLinkTo ?? []) {
    const id = relId(ref.value)
    if (id === undefined) continue
    if (ref.relationTo === 'categories') {
      const doc = await payload
        .findByID({ collection: 'categories', id, depth: 0, overrideAccess: false })
        .catch(() => null)
      if (doc?.slug) urls.push(`/deals/${doc.slug}`)
    } else {
      const doc = await payload
        .findByID({ collection: 'deals', id, depth: 0, overrideAccess: false })
        .catch(() => null)
      if (doc?.slug) urls.push(`/deal/${doc.slug}`)
    }
  }
  return urls
}

/** Slugs of every post in any state (a draft's slug is taken too). */
export async function loadTakenSlugs(payload: Payload): Promise<Set<string>> {
  const res = await payload.find({
    collection: 'posts',
    draft: true,
    limit: 5000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: { slug: true },
  })
  return new Set(res.docs.map((p) => p.slug).filter((s): s is string => Boolean(s)))
}

/** One line per page, for the prompt. */
export function renderInventory(items: readonly InventoryItem[]): string {
  return items
    .map((i) => `- ${i.url} | ${i.kind}${i.id !== undefined ? ` id=${i.id}` : ''} | ${i.label}`)
    .join('\n')
}
