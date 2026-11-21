// @vitest-environment node
import type { Payload } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getClickReport } from '../../src/lib/reports/clicks'
import { clearContent, getTestPayload, LONG_NOTE, uniq } from '../helpers/db'

let payload: Payload
const NOW = new Date('2026-11-21T12:00:00.000Z')
const daysAgo = (d: number, extraMs = 0) =>
  new Date(NOW.getTime() - d * 86_400_000 + extraMs).toISOString()

const ids: { storeA: number; storeB: number; dealA1: number; dealA2: number; dealB1: number } =
  {} as never

async function deal(store: number, title: string, category: number) {
  return payload.create({
    collection: 'deals',
    data: {
      title,
      store,
      category,
      productUrl: `https://shop.example.com/${uniq('p')}`,
      price: 10,
      currency: 'USD',
      editorNote: LONG_NOTE,
      status: 'live',
      _status: 'published',
      expiresAt: '2099-01-01T00:00:00.000Z',
    } as never,
  })
}

async function click(
  dealId: number,
  storeId: number,
  at: string,
  over: Record<string, unknown> = {},
) {
  await payload.create({
    collection: 'clicks',
    data: { deal: dealId, store: storeId, at, isBot: false, fromPath: '/', ...over } as never,
    overrideAccess: true,
    context: { disableRevalidate: true },
  })
}

beforeAll(async () => {
  payload = await getTestPayload()
  await clearContent(payload)
  const category = await payload.create({
    collection: 'categories',
    data: { title: 'Report Cat' } as never,
  })
  const a = await payload.create({
    collection: 'stores',
    data: { name: 'Store A', domain: 'a.example.com' } as never,
  })
  const b = await payload.create({
    collection: 'stores',
    data: { name: 'Store B', domain: 'b.example.com' } as never,
  })
  const a1 = await deal(a.id, 'Deal A1', category.id)
  const a2 = await deal(a.id, 'Deal A2', category.id)
  const b1 = await deal(b.id, 'Deal B1', category.id)
  Object.assign(ids, { storeA: a.id, storeB: b.id, dealA1: a1.id, dealA2: a2.id, dealB1: b1.id })

  // Inside 7 days: A1 x3 (/ , /, /deal/a1), A2 x1, B1 x2.
  await click(a1.id, a.id, daysAgo(1), { fromPath: '/' })
  await click(a1.id, a.id, daysAgo(2), { fromPath: '/' })
  await click(a1.id, a.id, daysAgo(6), { fromPath: '/deal/a1' })
  await click(a2.id, a.id, daysAgo(3), { fromPath: '/deal/a2' })
  await click(b1.id, b.id, daysAgo(4), { fromPath: '/' })
  await click(b1.id, b.id, daysAgo(5), { fromPath: undefined })
  // Bots inside the window: never counted in the figures.
  await click(a1.id, a.id, daysAgo(1), { isBot: true })
  await click(a1.id, a.id, daysAgo(2), { isBot: true })
  await click(b1.id, b.id, daysAgo(3), { isBot: true })
  // 7 to 30 days: B1 x2, A2 x1 (and one bot).
  await click(b1.id, b.id, daysAgo(10), { fromPath: '/deals/tech' })
  await click(b1.id, b.id, daysAgo(20), { fromPath: '/deals/tech' })
  await click(a2.id, a.id, daysAgo(29), { fromPath: '/' })
  await click(a2.id, a.id, daysAgo(15), { isBot: true })
  // Outside 30 days, and in the future: ignored.
  await click(a1.id, a.id, daysAgo(31))
  await click(a1.id, a.id, new Date(NOW.getTime() + 3_600_000).toISOString())
})

afterAll(async () => {
  await clearContent(payload)
})

describe('getClickReport', () => {
  it('matches the seeded clicks per window, excluding bots', async () => {
    const report = await getClickReport(payload, { now: NOW })
    const [w7, w30] = report.windows

    expect(report.generatedAt).toBe(NOW.toISOString())
    expect([w7.days, w30.days]).toEqual([7, 30])
    expect(w7.to).toBe(NOW.toISOString())
    expect(w7.from).toBe('2026-11-14T12:00:00.000Z')
    expect(w30.from).toBe('2026-10-22T12:00:00.000Z')

    expect(w7.total).toBe(6)
    expect(w7.bots).toBe(3)
    expect(w30.total).toBe(9)
    expect(w30.bots).toBe(4)

    expect(w7.perStore).toEqual([
      { storeId: ids.storeA, name: 'Store A', clicks: 4 },
      { storeId: ids.storeB, name: 'Store B', clicks: 2 },
    ])
    expect(w30.perStore).toEqual(
      [
        { storeId: ids.storeB, name: 'Store B', clicks: 4 },
        { storeId: ids.storeA, name: 'Store A', clicks: 5 },
      ].sort((x, y) => y.clicks - x.clicks),
    )

    expect(w7.perDeal.map((d) => [d.title, d.storeName, d.clicks])).toEqual([
      ['Deal A1', 'Store A', 3],
      ['Deal B1', 'Store B', 2],
      ['Deal A2', 'Store A', 1],
    ])
    // Totals add up across every breakdown.
    for (const w of report.windows) {
      expect(w.perStore.reduce((s, r) => s + r.clicks, 0)).toBe(w.total)
      expect(w.perDeal.reduce((s, r) => s + r.clicks, 0)).toBe(w.total)
      expect(w.topPaths.reduce((s, r) => s + r.clicks, 0)).toBe(w.total)
    }
    expect(w7.topPaths[0]).toEqual({ path: '/', clicks: 3 })
    expect(w7.topPaths.map((p) => p.path)).toContain('(direct or unknown)')
  })

  it('treats the window as inclusive at both ends', async () => {
    const edge = await getClickReport(payload, { now: new Date(daysAgo(6)), windowsDays: [1] })
    // Exactly one click sits at daysAgo(6) (the /deal/a1 one); the window [now-1d, now] includes it.
    expect(edge.windows[0].total).toBe(1)
  })
})
