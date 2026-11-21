import { describe, expect, it } from 'vitest'

import { buildProductKey, normaliseProductUrl } from '@/lib/deals/productKey'

describe('normaliseProductUrl', () => {
  it('lowercases the host, drops scheme, hash and trailing slash', () => {
    expect(normaliseProductUrl('HTTPS://Shop.Example.COM/Item/42/#reviews')).toBe(
      'shop.example.com/Item/42',
    )
  })

  it('treats http and https the same', () => {
    expect(normaliseProductUrl('http://example.com/a')).toBe(
      normaliseProductUrl('https://example.com/a'),
    )
  })

  it('strips tracking params but keeps identifying ones, sorted', () => {
    expect(
      normaliseProductUrl(
        'https://example.com/p?utm_source=x&color=red&gclid=abc&size=m&fbclid=1&tag=aff-20&pd_rd_w=z',
      ),
    ).toBe('example.com/p?color=red&size=m')
  })

  it('is order-insensitive for query params', () => {
    expect(normaliseProductUrl('https://e.com/p?b=2&a=1')).toBe(
      normaliseProductUrl('https://e.com/p?a=1&b=2'),
    )
  })

  it('handles a bare domain and the root path', () => {
    expect(normaliseProductUrl('https://example.com')).toBe('example.com')
    expect(normaliseProductUrl('https://example.com/')).toBe('example.com')
  })

  it('rejects non-http URLs and garbage', () => {
    expect(() => normaliseProductUrl('ftp://example.com/x')).toThrow()
    expect(() => normaliseProductUrl('not a url')).toThrow()
  })
})

describe('buildProductKey', () => {
  it('prefixes the store id', () => {
    expect(buildProductKey(7, 'https://Example.com/p/?utm_medium=email')).toBe('7|example.com/p')
  })

  it('differs across stores for the same URL', () => {
    expect(buildProductKey(1, 'https://e.com/p')).not.toBe(buildProductKey(2, 'https://e.com/p'))
  })
})
