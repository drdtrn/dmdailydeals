import { describe, expect, it } from 'vitest'

import { csvCell, csvRow } from '../../src/lib/newsletter/csv'
import { isValidEmail, normaliseEmail } from '../../src/lib/newsletter/email'
import { returnLocation } from '../../src/lib/newsletter/handler'
import { clientIp, createRateLimiter } from '../../src/lib/newsletter/rateLimit'
import { sanitiseSource } from '../../src/lib/newsletter/subscribe'

describe('email', () => {
  it('normalises by trimming and lowercasing', () => {
    expect(normaliseEmail('  Foo@Example.COM ')).toBe('foo@example.com')
    expect(normaliseEmail(42)).toBe('')
  })

  it.each(['a@b.co', 'first.last+tag@sub.example.com', 'x@a-b.example.org'])('accepts %s', (e) => {
    expect(isValidEmail(e)).toBe(true)
  })

  it.each([
    '',
    'plain',
    'a@b',
    '@b.com',
    'a b@c.com',
    'a@@b.com',
    'a..b@c.com',
    '.a@b.com',
    'a@b..com',
    'a@-b.com',
    `${'x'.repeat(65)}@example.com`,
    `a@${'x'.repeat(250)}.com`,
  ])('rejects %j', (e) => {
    expect(isValidEmail(e)).toBe(false)
  })
})

describe('source', () => {
  it('keeps short labels and falls back otherwise', () => {
    expect(sanitiseSource('home')).toBe('home')
    expect(sanitiseSource('styleguide-dark')).toBe('styleguide-dark')
    expect(sanitiseSource('<script>')).toBe('unknown')
    expect(sanitiseSource('x'.repeat(100))).toBe('unknown')
    expect(sanitiseSource(undefined)).toBe('unknown')
  })
})

describe('rate limiter', () => {
  it('allows `limit` hits per window per key, then recovers', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 })
    expect(limiter.hit('a', 0)).toBe(true)
    expect(limiter.hit('a', 10)).toBe(true)
    expect(limiter.hit('a', 20)).toBe(false)
    expect(limiter.hit('b', 20)).toBe(true)
    expect(limiter.hit('a', 1001)).toBe(true)
  })

  it('stays bounded under many distinct keys', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 10 })
    for (let i = 0; i < 100; i++) expect(limiter.hit(`ip-${i}`, i)).toBe(true)
  })
})

describe('clientIp', () => {
  it('uses the right-most X-Forwarded-For entry (the hop our proxy appended)', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('5.6.7.8')
  })

  it('ignores a spoofed left-most value', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8, 5.6.7.8' }))).toBe(
      '5.6.7.8',
    )
  })

  it('lets CF-Connecting-IP win over X-Forwarded-For', () => {
    expect(
      clientIp(new Headers({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' })),
    ).toBe('1.1.1.1')
  })

  it('returns null for missing, empty or whitespace headers', () => {
    expect(clientIp(new Headers())).toBeNull()
    expect(clientIp(new Headers({ 'cf-connecting-ip': '  ', 'x-forwarded-for': ' , ' }))).toBeNull()
    expect(clientIp(new Headers({ 'x-forwarded-for': '' }))).toBeNull()
  })
})

describe('returnLocation', () => {
  const origins = ['https://dmdailydeals.com']
  it('returns to the same-origin referer path with the flag and anchor', () => {
    expect(returnLocation('https://dmdailydeals.com/deals/tech?page=2', origins, 'success')).toBe(
      '/deals/tech?page=2&subscribed=1#newsletter',
    )
    expect(returnLocation('https://dmdailydeals.com/?subscribed=error', origins, 'success')).toBe(
      '/?subscribed=1#newsletter',
    )
  })
  it('falls back to / for foreign, missing or broken referers', () => {
    expect(returnLocation('https://evil.example/x', origins, 'error')).toBe(
      '/?subscribed=error#newsletter',
    )
    expect(returnLocation(null, origins, 'invalid')).toBe('/?subscribed=invalid#newsletter')
    expect(returnLocation('not a url', origins, 'success')).toBe('/?subscribed=1#newsletter')
  })
})

describe('csv', () => {
  it('quotes, escapes quotes and neutralises formulas', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell(null)).toBe('')
    expect(csvRow(['a', null, 'b c'])).toBe('a,,b c')
  })
})
