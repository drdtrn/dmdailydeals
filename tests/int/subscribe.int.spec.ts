// @vitest-environment node
import type { Payload } from 'payload'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { subscribersCsv } from '../../src/lib/newsletter/csv'
import { NEWSLETTER_CONSENT_VERSION } from '../../src/lib/newsletter/copy'
import { handleSubscribe } from '../../src/lib/newsletter/handler'
import { createRateLimiter, type RateLimiter } from '../../src/lib/newsletter/rateLimit'
import { getTestPayload } from '../helpers/db'

let payload: Payload
let limiter: RateLimiter
const ORIGIN = 'https://dmdailydeals.com'

const post = (
  body: unknown,
  { form = false, headers = {} }: { form?: boolean; headers?: Record<string, string> } = {},
) =>
  handleSubscribe(
    new Request(`${ORIGIN}/api/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json',
        ...headers,
      },
      body: form
        ? new URLSearchParams(body as Record<string, string>).toString()
        : JSON.stringify(body),
    }),
    { payload, limiter, allowedOrigins: [ORIGIN] },
  )

const rows = async (email?: string) =>
  (
    await payload.find({
      collection: 'subscribers',
      where: email ? { email: { equals: email } } : { id: { exists: true } },
      limit: 100,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
  ).docs

async function clear() {
  await payload.delete({
    collection: 'subscribers',
    where: { id: { exists: true } },
    overrideAccess: true,
  })
}

beforeAll(async () => {
  payload = await getTestPayload()
  await clear()
})
beforeEach(async () => {
  await clear()
  limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 })
})
afterAll(clear)

describe('POST /api/subscribe', () => {
  it('stores exactly one normalised row with consent facts and no IP', async () => {
    const res = await post(
      { email: '  New.Person@Example.COM ', source: 'home', website: '' },
      { headers: { 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'tester' } },
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(res.headers.get('cache-control')).toBe('no-store')

    const all = await rows()
    expect(all).toHaveLength(1)
    const row = all[0]
    expect(row).toMatchObject({
      email: 'new.person@example.com',
      status: 'active',
      source: 'home',
      consentText: NEWSLETTER_CONSENT_VERSION,
    })
    expect(row.confirmedAt ?? null).toBeNull()
    expect(new Date(row.consentAt).getTime()).toBeGreaterThan(Date.now() - 60_000)
    // PRIVACY: nothing about the requester is anywhere in the stored row.
    const dump = JSON.stringify(row)
    expect(dump).not.toContain('203.0.113.9')
    expect(dump).not.toContain('tester')
    expect(Object.keys(row).sort()).toEqual(
      [
        'confirmedAt',
        'consentAt',
        'consentText',
        'createdAt',
        'email',
        'id',
        'source',
        'status',
        'updatedAt',
      ].sort(),
    )
  })

  it('answers a form-encoded signup with a 303 back to the referring page', async () => {
    const res = await post(
      { email: 'form@example.com', source: 'home' },
      { form: true, headers: { Referer: `${ORIGIN}/?x=1` } },
    )
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/?x=1&subscribed=1#newsletter')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await rows('form@example.com')).toHaveLength(1)
  })

  it('never redirects off-site', async () => {
    const res = await post(
      { email: 'offsite@example.com' },
      { form: true, headers: { Referer: 'https://evil.example/phish' } },
    )
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/?subscribed=1#newsletter')
  })

  it('treats a duplicate as a no-op that still succeeds', async () => {
    await post({ email: 'dupe@example.com', source: 'home' })
    const [first] = await rows('dupe@example.com')
    const res = await post({ email: 'DUPE@example.com', source: 'other' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    const after = await rows('dupe@example.com')
    expect(after).toHaveLength(1)
    expect(after[0].updatedAt).toBe(first.updatedAt)
    expect(after[0].source).toBe('home')
  })

  it('re-activates an unsubscribed address with fresh consent', async () => {
    await payload.create({
      collection: 'subscribers',
      data: {
        email: 'back@example.com',
        status: 'unsubscribed',
        source: 'old',
        consentAt: '2020-01-01T00:00:00.000Z',
        consentText: 'old-version',
        confirmedAt: '2020-01-02T00:00:00.000Z',
      },
      overrideAccess: true,
    })
    const res = await post({ email: 'back@example.com', source: 'home' })
    expect(res.status).toBe(200)
    const [row] = await rows('back@example.com')
    expect(await rows()).toHaveLength(1)
    expect(row.status).toBe('active')
    expect(row.consentText).toBe(NEWSLETTER_CONSENT_VERSION)
    expect(new Date(row.consentAt).getFullYear()).toBeGreaterThanOrEqual(2026)
    expect(row.confirmedAt ?? null).toBeNull()
  })

  it('fakes success for a filled honeypot and stores nothing', async () => {
    const json = await post({ email: 'bot@example.com', website: 'http://spam.example' })
    expect(json.status).toBe(200)
    expect(await json.json()).toEqual({ ok: true })
    const form = await post(
      { email: 'bot2@example.com', website: 'x' },
      { form: true, headers: { Referer: `${ORIGIN}/` } },
    )
    expect(form.status).toBe(303)
    expect(form.headers.get('location')).toBe('/?subscribed=1#newsletter')
    expect(await rows()).toHaveLength(0)
  })

  it.each(['', 'nope', 'a@b', 'x'.repeat(300) + '@example.com'])(
    'rejects the invalid email %j with 400',
    async (email) => {
      const res = await post({ email })
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ ok: false })
      expect(await rows()).toHaveLength(0)
    },
  )

  it('redirects an invalid form email back with an error flag', async () => {
    const res = await post({ email: 'nope' }, { form: true, headers: { Referer: `${ORIGIN}/` } })
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/?subscribed=invalid#newsletter')
  })

  it('rejects unsupported and malformed bodies', async () => {
    const wrongType = await handleSubscribe(
      new Request(`${ORIGIN}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'email=a@b.co',
      }),
      { payload, limiter, allowedOrigins: [ORIGIN] },
    )
    expect(wrongType.status).toBe(415)
    const bad = await handleSubscribe(
      new Request(`${ORIGIN}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not json',
      }),
      { payload, limiter, allowedOrigins: [ORIGIN] },
    )
    expect(bad.status).toBe(400)
  })

  it('rate limits per IP: the 6th attempt in the window gets 429, other IPs are unaffected', async () => {
    const ip = { 'X-Forwarded-For': '198.51.100.7, 10.0.0.1' }
    for (let i = 0; i < 5; i++) {
      expect((await post({ email: `r${i}@example.com` }, { headers: ip })).status).toBe(200)
    }
    const blocked = await post({ email: 'r6@example.com' }, { headers: ip })
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('retry-after')).toBe('600')
    expect(await rows('r6@example.com')).toHaveLength(0)

    const other = await post(
      { email: 'r7@example.com' },
      { headers: { 'CF-Connecting-IP': '198.51.100.8' } },
    )
    expect(other.status).toBe(200)
  })
})

describe('subscribers CSV export', () => {
  it('lists the columns and escapes cells', async () => {
    await payload.create({
      collection: 'subscribers',
      data: {
        email: 'csv@example.com',
        source: 'home',
        consentAt: '2026-11-21T10:00:00.000Z',
        consentText: NEWSLETTER_CONSENT_VERSION,
      } as never,
      overrideAccess: true,
    })
    const csv = await subscribersCsv(payload)
    const [header, line] = csv.split('\r\n')
    expect(header).toBe('email,status,source,consentAt,consentText,createdAt')
    expect(line).toMatch(
      /^csv@example\.com,active,home,2026-11-21T10:00:00\.000Z,2026-11-21-v1,\d{4}-\d\d-\d\dT/,
    )
  })
})
