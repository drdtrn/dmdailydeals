import type { Payload } from 'payload'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { clearContent, getTestPayload, LONG_NOTE, uniq } from '../helpers/db'

let payload: Payload
let storeId: number
let categoryId: number

async function makeDeal(overrides: Record<string, unknown> = {}) {
  const title = uniq('deal')
  return payload.create({
    collection: 'deals',
    data: {
      title,
      store: storeId,
      category: categoryId,
      productUrl: `https://shop.example.com/p/${title}`,
      price: 100,
      wasPrice: 150,
      currency: 'USD',
      editorNote: LONG_NOTE,
      status: 'live',
      _status: 'published',
      // Far in the future unless a test says otherwise, so only the deals under test expire.
      expiresAt: '2099-01-01T00:00:00.000Z',
      ...overrides,
    } as never,
  })
}

async function makeDrop(date: string, status: 'scheduled' | 'live' | 'archived' = 'scheduled') {
  const [hero, ...picks] = await Promise.all(Array.from({ length: 6 }, () => makeDeal()))
  const drop = await payload.create({
    collection: 'drops',
    data: { date, hero: hero.id, picks: picks.map((p) => p.id), status } as never,
  })
  return { drop, hero, picks }
}

async function runDropsQueue() {
  await payload.jobs.queue({ task: 'publishDueDrops', queue: 'drops', input: {} })
  const result = await payload.jobs.run({ queue: 'drops', silent: true })
  const statuses = Object.values(result.jobStatus ?? {}).map((j) => j.status)
  // The job ran (completed jobs are deleted) and succeeded.
  expect(statuses).toEqual(['success'])
}

const jobsOf = async (taskSlug: string) =>
  (
    await payload.find({
      collection: 'payload-jobs',
      where: { taskSlug: { equals: taskSlug } },
      limit: 50,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
  ).docs

const statusOf = async (id: number) =>
  (await payload.findByID({ collection: 'drops', id, depth: 0, overrideAccess: true })).status

const dealStatus = async (id: number) =>
  (await payload.findByID({ collection: 'deals', id, depth: 0, overrideAccess: true })).status

async function clearJobs() {
  await payload.delete({
    collection: 'payload-jobs',
    where: { id: { exists: true } },
    overrideAccess: true,
  })
}

beforeAll(async () => {
  payload = await getTestPayload()
  await clearJobs()
  await clearContent(payload)
  const store = await payload.create({
    collection: 'stores',
    data: { name: 'Drop Engine Shop', domain: 'shop.example.com' } as never,
  })
  const category = await payload.create({
    collection: 'categories',
    data: { title: 'Engine Tech' } as never,
  })
  storeId = store.id
  categoryId = category.id
})

beforeEach(async () => {
  await clearJobs()
  for (const collection of ['drops', 'deals'] as const) {
    await payload.delete({
      collection,
      where: { id: { exists: true } },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
  }
})

afterAll(async () => {
  await clearJobs()
  await clearContent(payload)
})

describe('publishDueDrops', () => {
  it('publishes a due drop, archives the live one and expires due deals', async () => {
    const previous = await makeDrop('2020-01-01', 'live')
    const due = await makeDrop('2020-01-02')
    const stale = await makeDeal({ expiresAt: '2020-01-02T00:00:00.000Z' })
    const stillValid = await makeDeal({ expiresAt: '2099-01-01T00:00:00.000Z' })
    // Past its expiry, but part of the drop going live: must stay live.
    await payload.update({
      collection: 'deals',
      id: due.hero.id,
      data: { expiresAt: '2020-01-02T00:00:00.000Z' },
      context: { disableRevalidate: true },
    })

    await runDropsQueue()

    expect(await statusOf(due.drop.id)).toBe('live')
    expect(await statusOf(previous.drop.id)).toBe('archived')
    expect(await dealStatus(stale.id)).toBe('expired')
    expect(await dealStatus(stillValid.id)).toBe('live')
    expect(await dealStatus(due.hero.id)).toBe('live')
    // The previous drop's deals expire in 2099, so archiving the drop does not expire them.
    expect(await dealStatus(previous.hero.id)).toBe('live')

    const revalidate = await jobsOf('revalidateDrop')
    const ping = await jobsOf('pingIndexNow')
    expect(revalidate).toHaveLength(1)
    expect(ping).toHaveLength(1)
    expect(revalidate[0].queue).toBe('default')
    expect(revalidate[0].input).toMatchObject({ dropId: due.drop.id, expiredDealIds: [stale.id] })
    expect(ping[0].input).toMatchObject({ dropId: due.drop.id })
  })

  it('is idempotent: a second run changes nothing and queues nothing', async () => {
    const previous = await makeDrop('2020-02-01', 'live')
    const due = await makeDrop('2020-02-02')
    const stale = await makeDeal({ expiresAt: '2020-02-02T00:00:00.000Z' })

    await runDropsQueue()
    const before = {
      due: await payload.findByID({ collection: 'drops', id: due.drop.id, depth: 0 }),
      prev: await payload.findByID({ collection: 'drops', id: previous.drop.id, depth: 0 }),
      deal: await payload.findByID({ collection: 'deals', id: stale.id, depth: 0 }),
      followUps: (await jobsOf('revalidateDrop')).length + (await jobsOf('pingIndexNow')).length,
    }
    expect(before.followUps).toBe(2)

    await runDropsQueue()
    const after = {
      due: await payload.findByID({ collection: 'drops', id: due.drop.id, depth: 0 }),
      prev: await payload.findByID({ collection: 'drops', id: previous.drop.id, depth: 0 }),
      deal: await payload.findByID({ collection: 'deals', id: stale.id, depth: 0 }),
      followUps: (await jobsOf('revalidateDrop')).length + (await jobsOf('pingIndexNow')).length,
    }

    // updatedAt would move if the second run wrote anything.
    expect(after.due.updatedAt).toBe(before.due.updatedAt)
    expect(after.prev.updatedAt).toBe(before.prev.updatedAt)
    expect(after.deal.updatedAt).toBe(before.deal.updatedAt)
    expect(after.followUps).toBe(2)
  })

  it('keeps a not-yet-due drop scheduled and queues nothing', async () => {
    const live = await makeDrop('2020-03-01', 'live')
    const future = await makeDrop('2099-03-02')

    await runDropsQueue()

    expect(await statusOf(future.drop.id)).toBe('scheduled')
    expect(await statusOf(live.drop.id)).toBe('live')
    expect(await jobsOf('revalidateDrop')).toHaveLength(0)
    expect(await jobsOf('pingIndexNow')).toHaveLength(0)
  })

  it('lets the newest of several due drops win and archives the older ones', async () => {
    const live = await makeDrop('2020-04-01', 'live')
    const older = await makeDrop('2020-04-02')
    const newest = await makeDrop('2020-04-03')

    await runDropsQueue()

    expect(await statusOf(newest.drop.id)).toBe('live')
    expect(await statusOf(older.drop.id)).toBe('archived')
    expect(await statusOf(live.drop.id)).toBe('archived')
    const liveCount = await payload.count({
      collection: 'drops',
      where: { status: { equals: 'live' } },
    })
    expect(liveCount.totalDocs).toBe(1)
  })

  it('does not let a back-filled older drop replace a newer live one', async () => {
    const live = await makeDrop('2020-05-10', 'live')
    const backfill = await makeDrop('2020-05-01')

    await runDropsQueue()

    expect(await statusOf(live.drop.id)).toBe('live')
    expect(await statusOf(backfill.drop.id)).toBe('archived')
  })

  it('expires due deals even when no drop is due, and queues only the revalidation', async () => {
    const stale = await makeDeal({ expiresAt: '2020-06-01T00:00:00.000Z' })

    await runDropsQueue()

    expect(await dealStatus(stale.id)).toBe('expired')
    expect(await jobsOf('revalidateDrop')).toHaveLength(1)
    expect(await jobsOf('pingIndexNow')).toHaveLength(0)
  })

  it('the scheduler queues it on the drops queue, and a second schedule pass adds nothing while one is pending', async () => {
    await payload.jobs.handleSchedules({ queue: 'drops' })
    const first = await jobsOf('publishDueDrops')
    expect(first).toHaveLength(1)
    expect(first[0].queue).toBe('drops')

    await payload.jobs.handleSchedules({ queue: 'drops' })
    expect(await jobsOf('publishDueDrops')).toHaveLength(1)
  })
})

describe('pingIndexNow', () => {
  it('is a successful no-op for a local site or without a key', async () => {
    const due = await makeDrop('2020-07-01')
    const job = await payload.jobs.queue({
      task: 'pingIndexNow',
      queue: 'default',
      input: { dropId: due.drop.id },
    })
    const result = await payload.jobs.runByID({ id: job.id, silent: true })
    expect(Object.values(result.jobStatus ?? {}).map((j) => j.status)).toEqual(['success'])
  })
})
