import { afterEach, describe, expect, it } from 'vitest'

import { GET } from '../../src/app/indexnow-key.txt/route'
import {
  buildIndexNowUrls,
  indexNowKeyFile,
  isValidIndexNowKey,
  resolveIndexNowTarget,
} from '@/lib/seo/indexnow'

const KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'

describe('IndexNow key validation', () => {
  it.each([KEY, 'abcdefgh', 'A-b-C-1-2-3-4', 'a'.repeat(128)])('accepts %s', (key) => {
    expect(isValidIndexNowKey(key)).toBe(true)
  })

  it.each([
    undefined,
    null,
    '',
    'short',
    'a'.repeat(129),
    'has space here',
    'under_score_key',
    'ключ-ключ-ключ',
  ])('rejects %s', (key) => {
    expect(isValidIndexNowKey(key as string | null | undefined)).toBe(false)
  })

  it('the key file body is the trimmed key, or null', () => {
    expect(indexNowKeyFile(`  ${KEY}\n`)).toBe(KEY)
    expect(indexNowKeyFile('nope')).toBeNull()
    expect(indexNowKeyFile(undefined)).toBeNull()
  })
})

describe('IndexNow target', () => {
  it('sends the key route as keyLocation, on the same host', () => {
    const resolved = resolveIndexNowTarget('https://dmdailydeals.com', KEY)
    expect(resolved).toEqual({
      target: {
        host: 'dmdailydeals.com',
        origin: 'https://dmdailydeals.com',
        key: KEY,
        keyLocation: 'https://dmdailydeals.com/indexnow-key.txt',
      },
    })
  })

  it('skips without a key, with an invalid key, or on a local site', () => {
    expect(resolveIndexNowTarget('https://dmdailydeals.com', undefined)).toHaveProperty('skip')
    expect(resolveIndexNowTarget('https://dmdailydeals.com', 'bad key')).toHaveProperty('skip')
    expect(resolveIndexNowTarget('http://localhost:3000', KEY)).toHaveProperty('skip')
  })

  it('submits the home page, the drop, the archive and the deals once each', () => {
    expect(buildIndexNowUrls('https://x.test', '2026-11-21', ['a', 'a', null, 'b'])).toEqual([
      'https://x.test/',
      'https://x.test/drops/2026-11-21',
      'https://x.test/drops',
      'https://x.test/deal/a',
      'https://x.test/deal/b',
    ])
  })
})

describe('GET /indexnow-key.txt', () => {
  const original = process.env.INDEXNOW_KEY
  afterEach(() => {
    if (original === undefined) delete process.env.INDEXNOW_KEY
    else process.env.INDEXNOW_KEY = original
  })

  it('is 404 when the key is unset', async () => {
    delete process.env.INDEXNOW_KEY
    expect((await GET()).status).toBe(404)
  })

  it('is 404 when the key is invalid', async () => {
    process.env.INDEXNOW_KEY = 'too short'
    expect((await GET()).status).toBe(404)
  })

  it('returns the key as plain text when set', async () => {
    process.env.INDEXNOW_KEY = KEY
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/^text\/plain/)
    expect(await res.text()).toBe(KEY)
  })
})
