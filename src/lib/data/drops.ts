import type { Payload } from 'payload'

import type { Deal, Drop } from '@/payload-types'

import { totalPagesFor } from '@/lib/pagination'
import { relId } from '@/lib/relId'

import { DEAL_TAGS, dealsByIds, getLowestFlags } from './deals'
import { readCached } from './cache'

export type DropWithDeals = {
  drop: Drop
  /** The hero deal. If it is hidden (draft lifecycle), the first available pick stands in. */
  hero: Deal | null
  picks: Deal[]
  /** `Lowest in 90 days` flags by deal id, for the hero and picks. */
  lowest: Record<string, boolean>
}

async function resolveDrop(payload: Payload, drop: Drop): Promise<Omit<DropWithDeals, 'lowest'>> {
  const heroId = relId(drop.hero)
  const pickIds = (drop.picks ?? [])
    .map(relId)
    .filter((id): id is number | string => id !== undefined)
  const deals = await dealsByIds(payload, heroId !== undefined ? [heroId, ...pickIds] : pickIds)
  const heroDeal = deals.find((d) => String(d.id) === String(heroId)) ?? null
  const picks = deals.filter((d) => String(d.id) !== String(heroId))
  if (heroDeal) return { drop, hero: heroDeal, picks }
  const [first, ...rest] = picks
  return { drop, hero: first ?? null, picks: rest }
}

async function withLowest(resolved: Omit<DropWithDeals, 'lowest'>): Promise<DropWithDeals> {
  const all = [...(resolved.hero ? [resolved.hero] : []), ...resolved.picks]
  return { ...resolved, lowest: await getLowestFlags(all) }
}

/** The current drop: `status = live`, newest `publishAt`. Null before the first drop goes live. */
export async function getCurrentDrop(): Promise<DropWithDeals | null> {
  const resolved = await readCached(
    ['current-drop'],
    ['drop:current', 'drops', ...DEAL_TAGS],
    async (payload) => {
      const res = await payload.find({
        collection: 'drops',
        where: { status: { equals: 'live' } },
        sort: '-publishAt',
        limit: 1,
        depth: 0,
        pagination: false,
        overrideAccess: false,
      })
      const drop = res.docs[0]
      return drop ? resolveDrop(payload, drop) : null
    },
  )
  return resolved ? withLowest(resolved) : null
}

/** A live or archived drop by its `YYYY-MM-DD` date. Scheduled drops are invisible (access). */
export async function getDropByDate(date: string): Promise<DropWithDeals | null> {
  const resolved = await readCached(
    ['drop', date],
    [`drop:${date}`, ...DEAL_TAGS],
    async (payload) => {
      const res = await payload.find({
        collection: 'drops',
        where: { slug: { equals: date } },
        limit: 1,
        depth: 0,
        pagination: false,
        overrideAccess: false,
      })
      const drop = res.docs[0]
      return drop ? resolveDrop(payload, drop) : null
    },
  )
  return resolved ? withLowest(resolved) : null
}

export type DropNeighbours = { previous: string | null; next: string | null }

/** Slugs of the next older and next newer visible drops. */
export async function getDropNeighbours(date: string): Promise<DropNeighbours> {
  return readCached(['drop-neighbours', date], ['drops'], async (payload) => {
    const find = async (where: object, sort: string) => {
      const res = await payload.find({
        collection: 'drops',
        where: where as never,
        sort,
        limit: 1,
        depth: 0,
        pagination: false,
        overrideAccess: false,
        select: { slug: true },
      })
      return res.docs[0]?.slug ?? null
    }
    const [previous, next] = await Promise.all([
      find({ slug: { less_than: date } }, '-slug'),
      find({ slug: { greater_than: date } }, 'slug'),
    ])
    return { previous, next }
  })
}

export type DropListItem = {
  slug: string
  date: string
  pickCount: number
  hero: Pick<Deal, 'title' | 'image' | 'category'> | null
}

export const DROPS_PER_PAGE = 12

/** One page of the archive, newest first, each with its hero thumbnail and pick count. */
export async function listDrops(page: number): Promise<{
  items: DropListItem[]
  totalDocs: number
  totalPages: number
}> {
  return readCached(['drops-list', page], ['drops', ...DEAL_TAGS], async (payload) => {
    const res = await payload.find({
      collection: 'drops',
      sort: '-date',
      limit: DROPS_PER_PAGE,
      page,
      depth: 0,
      overrideAccess: false,
    })
    const heroIds = res.docs.map((d) => relId(d.hero)).filter((id) => id !== undefined)
    const heroes = await dealsByIds(payload, heroIds as (number | string)[])
    const byId = new Map(heroes.map((h) => [String(h.id), h]))
    const items: DropListItem[] = res.docs.map((drop) => {
      const hero = byId.get(String(relId(drop.hero)))
      return {
        slug: drop.slug ?? drop.date.slice(0, 10),
        date: drop.date,
        // The hero is counted with the picks: "7 deals" is what a reader sees on the drop page.
        pickCount: (drop.picks?.length ?? 0) + 1,
        hero: hero ? { title: hero.title, image: hero.image, category: hero.category } : null,
      }
    })
    return {
      items,
      totalDocs: res.totalDocs,
      totalPages: totalPagesFor(res.totalDocs, DROPS_PER_PAGE),
    }
  })
}

/** Recent visible drops whose hero or picks include a deal of this category. */
export async function getDropsForCategory(
  categoryId: number,
  categorySlug: string,
  limit = 6,
): Promise<DropListItem[]> {
  return readCached(
    ['drops-for-category', categorySlug, limit],
    [`category:${categorySlug}`, 'drops', ...DEAL_TAGS],
    async (payload) => {
      const res = await payload.find({
        collection: 'drops',
        where: {
          or: [
            { 'hero.category': { equals: categoryId } },
            { 'picks.category': { equals: categoryId } },
          ],
        },
        sort: '-date',
        limit,
        depth: 0,
        pagination: false,
        overrideAccess: false,
      })
      const seen = new Set<string>()
      const drops = res.docs.filter((d) =>
        seen.has(String(d.id)) ? false : (seen.add(String(d.id)), true),
      )
      const heroes = await dealsByIds(
        payload,
        drops.map((d) => relId(d.hero)).filter((id): id is number | string => id !== undefined),
      )
      const byId = new Map(heroes.map((h) => [String(h.id), h]))
      return drops.map((drop) => {
        const hero = byId.get(String(relId(drop.hero)))
        return {
          slug: drop.slug ?? drop.date.slice(0, 10),
          date: drop.date,
          pickCount: (drop.picks?.length ?? 0) + 1,
          hero: hero ? { title: hero.title, image: hero.image, category: hero.category } : null,
        }
      })
    },
  )
}
