// @vitest-environment node
import type { Payload } from 'payload'

import os from 'os'
import path from 'path'
import sharp from 'sharp'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearContent, getTestPayload, LONG_NOTE, uniq } from '../helpers/db'

let payload: Payload
let storeId: number
let categoryId: number
let imageId: number

type Sent = { method: string; isPhoto: boolean; body: unknown }
let sent: Sent[]

function stubTelegram() {
  let id = 500
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const method = String(url).split('/').pop() as string
      const isPhoto = init?.body instanceof FormData
      sent.push({
        method,
        isPhoto,
        body: isPhoto ? (init!.body as FormData).get('photo') : JSON.parse(String(init?.body)),
      })
      return Response.json({ ok: true, result: { message_id: id++ } })
    }),
  )
}

async function makeDeal(over: Record<string, unknown> = {}) {
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
      expiresAt: '2099-01-01T00:00:00.000Z',
      ...over,
    } as never,
  })
}

async function makeDrop(
  date: string,
  status: 'scheduled' | 'live' = 'scheduled',
  withImage = false,
) {
  const hero = await makeDeal(withImage ? { image: imageId } : {})
  const picks = await Promise.all(Array.from({ length: 5 }, () => makeDeal()))
  return payload.create({
    collection: 'drops',
    data: { date, hero: hero.id, picks: picks.map((p) => p.id), status } as never,
  })
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

async function clearJobs() {
  await payload.delete({
    collection: 'payload-jobs',
    where: { id: { exists: true } },
    overrideAccess: true,
  })
}

async function runTelegramJob(dropId: number) {
  await payload.jobs.queue({
    task: 'postDropToTelegram',
    queue: 'default',
    input: { dropId },
  })
  return payload.jobs.run({ queue: 'default', silent: true })
}

const setToggle = (telegramEnabled: boolean) =>
  payload.updateGlobal({
    slug: 'site-settings',
    data: { telegramEnabled },
    context: { disableRevalidate: true },
  })

const ENV = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHANNEL_ID', 'NEXT_PUBLIC_SERVER_URL'] as const
const saved: Partial<Record<(typeof ENV)[number], string | undefined>> = {}

function configure() {
  process.env.TELEGRAM_BOT_TOKEN = '999:test-token'
  process.env.TELEGRAM_CHANNEL_ID = '@testchannel'
  process.env.NEXT_PUBLIC_SERVER_URL = 'https://dmdailydeals.example'
}

beforeAll(async () => {
  payload = await getTestPayload()
  for (const k of ENV) saved[k] = process.env[k]
  await clearJobs()
  await clearContent(payload)
  const store = await payload.create({
    collection: 'stores',
    data: { name: 'TG Shop', domain: 'tg.example.com' } as never,
  })
  const category = await payload.create({
    collection: 'categories',
    data: { title: 'TG Cat' } as never,
  })
  storeId = store.id
  categoryId = category.id

  const file = path.join(os.tmpdir(), `tg-hero-${Date.now()}.png`)
  await sharp({ create: { width: 800, height: 600, channels: 3, background: '#cc3322' } })
    .png()
    .toFile(file)
  const media = await payload.create({
    collection: 'media',
    data: { alt: 'Hero' },
    filePath: file,
    overrideAccess: true,
  })
  imageId = media.id
})

beforeEach(async () => {
  sent = []
  await clearJobs()
  for (const collection of ['drops', 'deals'] as const) {
    await payload.delete({
      collection,
      where: { id: { exists: true } },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
  }
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_CHANNEL_ID
  stubTelegram()
  await setToggle(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

afterAll(async () => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  await setToggle(false)
  await clearJobs()
  await clearContent(payload)
})

describe('publishDueDrops queues postDropToTelegram', () => {
  it('queues it once on the default queue, and a second run does not queue it again', async () => {
    const drop = await makeDrop('2020-05-01')
    const run = async () => {
      await payload.jobs.queue({ task: 'publishDueDrops', queue: 'drops', input: {} })
      const result = await payload.jobs.run({ queue: 'drops', silent: true })
      expect(Object.values(result.jobStatus ?? {}).map((j) => j.status)).toEqual(['success'])
    }
    await run()
    const first = await jobsOf('postDropToTelegram')
    expect(first).toHaveLength(1)
    expect(first[0].queue).toBe('default')
    expect(first[0].input).toMatchObject({ dropId: drop.id })

    await run()
    expect(await jobsOf('postDropToTelegram')).toHaveLength(1)
    expect(sent).toHaveLength(0)
  })
})

describe('postDropToTelegram task', () => {
  it('is a successful no-op without the env vars', async () => {
    await setToggle(true)
    const drop = await makeDrop('2020-05-02', 'live')
    const result = await runTelegramJob(drop.id)
    expect(Object.values(result.jobStatus ?? {}).map((j) => j.status)).toEqual(['success'])
    expect(sent).toHaveLength(0)
  })

  it('is a successful no-op with the site-settings toggle off', async () => {
    configure()
    const drop = await makeDrop('2020-05-03', 'live')
    const result = await runTelegramJob(drop.id)
    expect(Object.values(result.jobStatus ?? {}).map((j) => j.status)).toEqual(['success'])
    expect(sent).toHaveLength(0)
    const after = await payload.findByID({ collection: 'drops', id: drop.id, depth: 0 })
    expect(after.telegram?.photoMessageId ?? null).toBeNull()
  })

  it('is a no-op for a local site URL', async () => {
    configure()
    process.env.NEXT_PUBLIC_SERVER_URL = 'http://localhost:3000'
    await setToggle(true)
    const drop = await makeDrop('2020-05-04', 'live')
    await runTelegramJob(drop.id)
    expect(sent).toHaveLength(0)
  })

  it('uploads the hero image from disk, posts the list, stores both ids and never re-posts', async () => {
    configure()
    await setToggle(true)
    const drop = await makeDrop('2020-05-05', 'live', true)

    const first = await runTelegramJob(drop.id)
    expect(Object.values(first.jobStatus ?? {}).map((j) => j.status)).toEqual(['success'])
    expect(sent.map((s) => s.method)).toEqual(['sendPhoto', 'sendMessage'])
    const photo = sent[0].body as Blob
    expect(photo.size).toBeGreaterThan(100)
    expect(photo.type).toBe('image/png')

    const stored = await payload.findByID({ collection: 'drops', id: drop.id, depth: 0 })
    expect(stored.telegram).toMatchObject({ photoMessageId: 500, listMessageId: 501 })
    expect(stored.telegram?.postedAt).toBeTruthy()

    // The same task queued again (a retry, or a duplicate) sends nothing.
    await runTelegramJob(drop.id)
    expect(sent).toHaveLength(2)
  })

  it('falls back to text when the hero has no image', async () => {
    configure()
    await setToggle(true)
    const drop = await makeDrop('2020-05-06', 'live')
    await runTelegramJob(drop.id)
    expect(sent.map((s) => s.method)).toEqual(['sendMessage', 'sendMessage'])
  })

  it('after a failed list message, the next attempt sends only the list', async () => {
    configure()
    await setToggle(true)
    const drop = await makeDrop('2020-05-07', 'live')

    // First attempt: the photo-less hero message succeeds, the list fails.
    let n = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const method = String(url).split('/').pop() as string
        sent.push({ method, isPhoto: false, body: JSON.parse(String(init?.body)) })
        n++
        return n === 2
          ? Response.json({ ok: false, error_code: 500, description: 'boom' }, { status: 500 })
          : Response.json({ ok: true, result: { message_id: 600 + n } })
      }),
    )
    const failed = await runTelegramJob(drop.id)
    expect(Object.values(failed.jobStatus ?? {}).map((j) => j.status)).not.toContain('success')
    const mid = await payload.findByID({ collection: 'drops', id: drop.id, depth: 0 })
    expect(mid.telegram?.photoMessageId).toBe(601)
    expect(mid.telegram?.listMessageId ?? null).toBeNull()

    sent = []
    stubTelegram()
    await clearJobs()
    await runTelegramJob(drop.id)
    expect(sent.map((s) => s.method)).toEqual(['sendMessage'])
    const done = await payload.findByID({ collection: 'drops', id: drop.id, depth: 0 })
    expect(done.telegram?.photoMessageId).toBe(601)
    expect(done.telegram?.listMessageId).toBe(500)
  })
})
