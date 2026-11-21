import type { Payload } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildProductKey } from '@/lib/deals/productKey'

import { clearContent, expectInvalid, getTestPayload, LONG_NOTE, uniq } from '../helpers/db'

let payload: Payload
let storeId: number
let categoryId: number

async function makeDeal(
  overrides: Record<string, unknown> = {},
  { published = true }: { published?: boolean } = {},
) {
  const title = uniq('deal')
  return payload.create({
    collection: 'deals',
    ...(published ? {} : { draft: true as const }),
    data: {
      title,
      store: storeId,
      category: categoryId,
      productUrl: `https://shop.example.com/p/${title}?utm_source=test`,
      price: 100,
      wasPrice: 150,
      currency: 'USD',
      editorNote: LONG_NOTE,
      status: 'live',
      _status: published ? 'published' : 'draft',
      ...overrides,
    } as never,
  })
}

async function makeDeals(n: number) {
  const deals = []
  for (let i = 0; i < n; i++) deals.push(await makeDeal())
  return deals
}

const createDrop = (data: {
  date: string
  hero: number
  picks: number[]
  status?: 'scheduled' | 'live' | 'archived'
}) => payload.create({ collection: 'drops', data: data as never })

const snapshotsFor = async (deal: { productUrl: string }) => {
  const key = buildProductKey(storeId, deal.productUrl)
  const res = await payload.find({
    collection: 'price-snapshots',
    where: { productKey: { equals: key } },
    sort: 'capturedAt',
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs
}

beforeAll(async () => {
  payload = await getTestPayload()
  await clearContent(payload)
  const store = await payload.create({
    collection: 'stores',
    data: { name: 'Example Shop', domain: 'shop.example.com' } as never,
  })
  const category = await payload.create({
    collection: 'categories',
    data: { title: 'Tech' } as never,
  })
  storeId = store.id
  categoryId = category.id
})

afterAll(async () => {
  await clearContent(payload)
})

describe('drops validation', () => {
  it('accepts a valid drop and computes publishAt (DST aware)', async () => {
    const [hero, ...picks] = await makeDeals(6)
    const winter = await createDrop({
      date: '2031-03-08',
      hero: hero.id,
      picks: picks.map((p) => p.id),
    })
    expect(winter.slug).toBe('2031-03-08')
    expect(winter.status).toBe('scheduled')
    expect(winter.publishAt).toBe('2031-03-08T14:00:00.000Z') // EST

    const summer = await createDrop({
      date: '2031-03-09',
      hero: hero.id,
      picks: picks.map((p) => p.id),
    })
    expect(summer.publishAt).toBe('2031-03-09T13:00:00.000Z') // EDT after the change
  })

  it('rejects a drop with 4 picks', async () => {
    const [hero, ...picks] = await makeDeals(5)
    await expectInvalid(
      createDrop({ date: '2031-04-01', hero: hero.id, picks: picks.map((p) => p.id) }),
      /5 to 10 picks/,
    )
  })

  it('rejects a drop with 11 picks', async () => {
    const [hero, ...picks] = await makeDeals(12)
    await expectInvalid(
      createDrop({ date: '2031-04-02', hero: hero.id, picks: picks.map((p) => p.id) }),
      /5 to 10 picks/,
    )
  })

  it('rejects a hero that is also a pick', async () => {
    const deals = await makeDeals(6)
    await expectInvalid(
      createDrop({
        date: '2031-04-03',
        hero: deals[0].id,
        picks: deals.map((d) => d.id), // includes the hero
      }),
      /hero deal must not also be one of the picks/,
    )
  })

  it('rejects a second drop on the same date', async () => {
    const [hero, ...picks] = await makeDeals(6)
    const data = { date: '2031-04-04', hero: hero.id, picks: picks.map((p) => p.id) }
    await createDrop(data)
    await expect(createDrop(data)).rejects.toThrow()
    const count = await payload.count({
      collection: 'drops',
      where: { slug: { equals: '2031-04-04' } },
    })
    expect(count.totalDocs).toBe(1)
  })

  it('keeps validating when only some fields are updated', async () => {
    const [hero, ...picks] = await makeDeals(6)
    const drop = await createDrop({
      date: '2031-04-05',
      hero: hero.id,
      picks: picks.map((p) => p.id),
    })
    const updated = await payload.update({
      collection: 'drops',
      id: drop.id,
      data: { intro: 'Hello' },
    })
    expect(updated.intro).toBe('Hello')
    // Moving the hero into the picks via a partial update is still rejected.
    await expectInvalid(
      payload.update({ collection: 'drops', id: drop.id, data: { hero: picks[0].id } }),
      /hero deal must not also be one of the picks/,
    )
  })
})

describe('deals', () => {
  it('requires an editor note of at least 140 characters to publish, but not for drafts', async () => {
    await expectInvalid(makeDeal({ editorNote: 'Too short.' }), /at least 140 characters/)
    const draft = await makeDeal({ editorNote: 'Too short.' }, { published: false })
    expect(draft._status).toBe('draft')
  })

  it('defaults expiresAt to the next drop', async () => {
    const deal = await makeDeal()
    expect(deal.expiresAt).toBeTruthy()
    const expires = new Date(deal.expiresAt as string)
    expect(expires.getTime()).toBeGreaterThan(Date.now())
    expect(expires.getTime() - Date.now()).toBeLessThanOrEqual(24 * 3600 * 1000 + 1000)
    expect(deal.priceCheckedAt).toBeTruthy()
  })
})

describe('price snapshots', () => {
  it('writes one snapshot on first publish and one per real price change', async () => {
    const deal = await makeDeal({ price: 100 })
    expect(await snapshotsFor(deal)).toHaveLength(1)

    await payload.update({ collection: 'deals', id: deal.id, data: { price: 80 } })
    const after = await snapshotsFor(deal)
    expect(after).toHaveLength(2)
    expect(after.map((s) => s.price)).toEqual([100, 80])
  })

  it('creates no snapshot when other fields change', async () => {
    const deal = await makeDeal({ price: 100 })
    await payload.update({
      collection: 'deals',
      id: deal.id,
      data: { title: 'A new title', couponCode: 'SAVE5', editorNote: LONG_NOTE + ' Updated.' },
    })
    expect(await snapshotsFor(deal)).toHaveLength(1)
  })

  it('creates no snapshot for drafts or autosaves, and none when the price is unchanged', async () => {
    const draft = await makeDeal({ price: 100 }, { published: false })
    expect(await snapshotsFor(draft)).toHaveLength(0)

    const deal = await makeDeal({ price: 100 })
    await payload.update({
      collection: 'deals',
      id: deal.id,
      data: { price: 60 },
      draft: true,
      autosave: true,
    })
    expect(await snapshotsFor(deal)).toHaveLength(1)
    const live = await payload.findByID({ collection: 'deals', id: deal.id, depth: 0 })
    expect(live.price).toBe(100) // the autosave did not touch the published document

    // Re-saving at the same price writes nothing
    await payload.update({ collection: 'deals', id: deal.id, data: { price: 100 } })
    expect(await snapshotsFor(deal)).toHaveLength(1)

    // Publishing the autosaved draft is the real change: exactly one more row
    await payload.update({
      collection: 'deals',
      id: deal.id,
      data: { price: 60, _status: 'published' },
    })
    expect(await snapshotsFor(deal)).toHaveLength(2)
  })

  it('does not duplicate when unpublished and republished at the same price', async () => {
    const deal = await makeDeal({ price: 100 })
    await payload.update({
      collection: 'deals',
      id: deal.id,
      data: { _status: 'draft' },
    })
    await payload.update({
      collection: 'deals',
      id: deal.id,
      data: { _status: 'published' },
    })
    expect(await snapshotsFor(deal)).toHaveLength(1)
  })

  it('treats the same product behind different tracking links as one history', async () => {
    const a = await makeDeal({ productUrl: 'https://shop.example.com/p/same?utm_source=a#x' })
    await makeDeal({ productUrl: 'https://SHOP.example.com/p/same/?gclid=zzz', price: 100 })
    expect(await snapshotsFor(a)).toHaveLength(1) // same key, same price: no duplicate row
  })
})

describe('access control (anonymous reads)', () => {
  it('hides drafts, draft-status deals and scheduled drops from the public', async () => {
    const [hero, ...picks] = await makeDeals(6)
    const draft = await makeDeal({}, { published: false })
    const parked = await makeDeal({ status: 'draft' })
    const scheduled = await createDrop({
      date: '2031-05-01',
      hero: hero.id,
      picks: picks.map((p) => p.id),
    })
    const live = await createDrop({
      date: '2031-05-02',
      hero: hero.id,
      picks: picks.map((p) => p.id),
      status: 'live',
    })

    const publicDeals = await payload.find({
      collection: 'deals',
      overrideAccess: false,
      limit: 100,
      depth: 0,
    })
    const ids = publicDeals.docs.map((d) => d.id)
    expect(ids).toContain(hero.id)
    expect(ids).not.toContain(draft.id)
    expect(ids).not.toContain(parked.id)

    const publicDrops = await payload.find({
      collection: 'drops',
      overrideAccess: false,
      limit: 100,
      depth: 0,
    })
    const dropIds = publicDrops.docs.map((d) => d.id)
    expect(dropIds).toContain(live.id)
    expect(dropIds).not.toContain(scheduled.id)
  })

  it('has no public read or write on clicks, subscribers and snapshots', async () => {
    for (const collection of ['clicks', 'subscribers', 'price-snapshots'] as const) {
      await expect(payload.find({ collection, overrideAccess: false })).rejects.toThrow()
    }
    await expect(
      payload.create({
        collection: 'subscribers',
        data: { email: 'nobody@example.com' } as never,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})
