import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  buildArticle,
  buildBlogPosting,
  buildBreadcrumbList,
  buildCollectionPage,
  buildItemList,
  buildOrganization,
  buildProduct,
  buildWebSite,
  serializeJsonLd,
  type ProductInput,
} from '@/lib/seo/jsonld'
import { ROOT_CRUMB } from '@/lib/seo/site'
import type { Media } from '@/payload-types'

const ORIGIN = 'https://dmdailydeals.test'
const NOW = new Date('2026-11-21T15:00:00.000Z')

const image = {
  id: 1,
  alt: 'Headphones',
  url: '/api/media/file/headphones.jpg',
  width: 2000,
  height: 1500,
  sizes: {
    hero: { url: '/api/media/file/headphones-1200.jpg', width: 1200, height: 900 },
    og: { url: '/api/media/file/headphones-og.jpg', width: 1200, height: 630 },
  },
} as unknown as Media

const live: ProductInput = {
  title: 'Over-Ear Wireless Headphones',
  slug: 'over-ear-wireless-headphones',
  editorNote:
    'Lowest price we have seen\n\nin a year, <b>with</b> a real saving over the usual price.',
  price: 149.99,
  currency: 'USD',
  status: 'live',
  expiresAt: '2026-11-22T14:00:00.000Z',
  image,
}

/** Every `@type` and every key in a JSON-LD tree. */
function walk(value: unknown, types: Set<string>, keys: Set<string>) {
  if (Array.isArray(value)) return value.forEach((v) => walk(v, types, keys))
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      keys.add(k)
      if (k === '@type') [v].flat().forEach((t) => types.add(String(t)))
      walk(v, types, keys)
    }
  }
}

function urlsIn(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => urlsIn(v, out))
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (['url', 'item', 'image', 'logo', 'mainEntityOfPage'].includes(k) && typeof v === 'string')
        out.push(v)
      else urlsIn(v, out)
    }
  }
  return out
}

const FORBIDDEN_TYPES = [
  'FAQPage',
  'HowTo',
  'Event',
  'AggregateOffer',
  'AggregateRating',
  'Review',
  'SearchAction',
  'MerchantReturnPolicy',
  'OfferShippingDetails',
  'UnitPriceSpecification',
  'PriceSpecification',
]
const FORBIDDEN_KEYS = [
  'aggregateRating',
  'review',
  'potentialAction',
  'priceSpecification',
  'hasMerchantReturnPolicy',
  'shippingDetails',
  'strikethroughPrice',
  'highPrice',
  'lowPrice',
]

function everything() {
  const crumbs = [ROOT_CRUMB, { label: 'Tech', href: '/deals/tech' }, { label: live.title }]
  return [
    buildWebSite(ORIGIN),
    buildOrganization(ORIGIN),
    buildProduct(ORIGIN, live, NOW),
    buildBreadcrumbList(ORIGIN, crumbs, '/deal/x'),
    buildArticle(ORIGIN, {
      headline: 'Deals of Saturday, November 21, 2026',
      description: 'The drop',
      path: '/drops/2026-11-21',
      datePublished: '2026-11-21T14:00:00.000Z',
      dateModified: '2026-11-21T15:30:00.000Z',
      image,
    }),
    buildItemList(ORIGIN, 'Deals', ['/deal/a', '/deal/b']),
    buildCollectionPage(ORIGIN, {
      name: 'Tech deals',
      path: '/deals/tech',
      itemPaths: ['/deal/a'],
    }),
  ]
}

describe('JSON-LD builders', () => {
  it('every block has the schema.org context', () => {
    for (const block of everything()) {
      expect(block, JSON.stringify(block)).toMatchObject({ '@context': 'https://schema.org' })
    }
  })

  it('never emits a forbidden type or property', () => {
    const types = new Set<string>()
    const keys = new Set<string>()
    for (const block of everything()) walk(block, types, keys)
    for (const t of FORBIDDEN_TYPES) expect(types.has(t), `type ${t}`).toBe(false)
    for (const k of FORBIDDEN_KEYS) expect(keys.has(k), `key ${k}`).toBe(false)
  })

  it('emits only absolute URLs', () => {
    for (const block of everything()) {
      const urls = urlsIn(block)
      expect(urls.length).toBeGreaterThan(0)
      for (const url of urls) expect(url, url).toMatch(/^https:\/\/dmdailydeals\.test\//)
    }
  })

  describe('WebSite and Organization', () => {
    it('WebSite has a name and url and no search action', () => {
      expect(buildWebSite(ORIGIN)).toEqual({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'DMDailyDeals',
        url: `${ORIGIN}/`,
      })
    })

    it('Organization has name, url and an absolute logo that is at least 112px', () => {
      const org = buildOrganization(ORIGIN)
      expect(org).toMatchObject({
        '@type': 'Organization',
        name: 'DMDailyDeals',
        url: `${ORIGIN}/`,
      })
      expect((org as { logo?: string }).logo).toBe(`${ORIGIN}/brand/dm-monogram-black.png`)
      // PNG header: width and height are big-endian uint32 at bytes 16 and 20.
      const png = readFileSync(path.join(process.cwd(), 'public/brand/dm-monogram-black.png'))
      expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(112)
      expect(png.readUInt32BE(20)).toBeGreaterThanOrEqual(112)
    })
  })

  describe('Product', () => {
    it('a live deal has a Product with a single Offer', () => {
      const product = buildProduct(ORIGIN, live, NOW)
      expect(product).not.toBeNull()
      expect(product).toMatchObject({
        '@type': 'Product',
        name: live.title,
        url: `${ORIGIN}/deal/over-ear-wireless-headphones`,
        image: [`${ORIGIN}/api/media/file/headphones-1200.jpg`],
        offers: {
          '@type': 'Offer',
          price: 149.99,
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          priceValidUntil: '2026-11-22T14:00:00.000Z',
          url: `${ORIGIN}/deal/over-ear-wireless-headphones`,
        },
      })
      expect(Array.isArray((product as { offers: unknown }).offers)).toBe(false)
    })

    it('the Offer points at the canonical deal page, never at /go', () => {
      expect(JSON.stringify(buildProduct(ORIGIN, live, NOW))).not.toContain('/go/')
    })

    it('uses the editor note as the description, whitespace normalised', () => {
      expect(buildProduct(ORIGIN, live, NOW)).toMatchObject({
        description:
          'Lowest price we have seen in a year, <b>with</b> a real saving over the usual price.',
      })
    })

    it('does not mark up the was-price', () => {
      const product = buildProduct(ORIGIN, { ...live, wasPrice: 299 } as ProductInput, NOW)
      expect(JSON.stringify(product)).not.toContain('299')
    })

    it.each(['expired', 'sold-out', 'draft'] as const)('a %s deal has no Product', (status) => {
      expect(buildProduct(ORIGIN, { ...live, status }, NOW)).toBeNull()
    })

    it('omits a priceValidUntil that is already past, and one that is missing', () => {
      const past = buildProduct(ORIGIN, { ...live, expiresAt: '2026-11-21T14:59:00.000Z' }, NOW)
      expect(past?.offers).not.toHaveProperty('priceValidUntil')
      const none = buildProduct(ORIGIN, { ...live, expiresAt: null }, NOW)
      expect(none?.offers).not.toHaveProperty('priceValidUntil')
    })

    it('omits the image when the deal has none instead of inventing one', () => {
      expect(buildProduct(ORIGIN, { ...live, image: null }, NOW)).not.toHaveProperty('image')
    })
  })

  describe('BreadcrumbList', () => {
    it('numbers the items and gives every one an absolute url, the last its own page', () => {
      const list = buildBreadcrumbList(
        ORIGIN,
        [ROOT_CRUMB, { label: 'Home', href: '/deals/home' }, { label: 'A lamp' }],
        '/deal/a-lamp',
      )
      expect(list.itemListElement).toEqual([
        { '@type': 'ListItem', position: 1, name: 'DMDailyDeals', item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'Home', item: `${ORIGIN}/deals/home` },
        { '@type': 'ListItem', position: 3, name: 'A lamp', item: `${ORIGIN}/deal/a-lamp` },
      ])
    })

    it('the root crumb is not "Home", so the Home category does not read Home > Home', () => {
      expect(ROOT_CRUMB.label).not.toBe('Home')
    })

    it('skips an intermediate crumb that has no link', () => {
      const list = buildBreadcrumbList(
        ORIGIN,
        [ROOT_CRUMB, { label: 'Stores' }, { label: 'Acme' }],
        '/stores/acme',
      )
      expect(list.itemListElement).toHaveLength(2)
    })
  })

  describe('Article', () => {
    const base = {
      headline: 'Deals of Saturday, November 21, 2026',
      path: '/drops/2026-11-21',
      datePublished: '2026-11-21T14:00:00.000Z',
      dateModified: '2026-11-21T15:30:00.000Z',
    }

    it('has headline, image, dates with a timezone, and the Organization as author and publisher', () => {
      const article = buildArticle(ORIGIN, { ...base, image })
      expect(article).toMatchObject({
        '@type': 'Article',
        headline: base.headline,
        datePublished: '2026-11-21T14:00:00.000Z',
        dateModified: '2026-11-21T15:30:00.000Z',
        image: [`${ORIGIN}/api/media/file/headphones-og.jpg`],
        author: { '@type': 'Organization', name: 'DMDailyDeals' },
        publisher: { '@type': 'Organization', name: 'DMDailyDeals' },
        mainEntityOfPage: `${ORIGIN}/drops/2026-11-21`,
      })
      expect(article.datePublished).toMatch(/Z$/)
    })

    it('falls back to the default OG image and never lets modified precede published', () => {
      const article = buildArticle(ORIGIN, { ...base, dateModified: '2026-11-20T00:00:00.000Z' })
      expect(article.image).toEqual([`${ORIGIN}/brand/og-default.png`])
      expect(article.dateModified).toBe(article.datePublished)
    })
  })

  describe('lists', () => {
    it('ItemList and CollectionPage list absolute deal URLs in order', () => {
      expect(buildItemList(ORIGIN, 'n', ['/deal/a', '/deal/b'])).toMatchObject({
        numberOfItems: 2,
        itemListElement: [
          { position: 1, url: `${ORIGIN}/deal/a` },
          { position: 2, url: `${ORIGIN}/deal/b` },
        ],
      })
      const page = buildCollectionPage(ORIGIN, {
        name: 'Tech deals',
        path: '/deals/tech',
        itemPaths: [],
      })
      expect(page).not.toHaveProperty('mainEntity')
    })
  })

  describe('serializeJsonLd', () => {
    it('escapes < so a value cannot close the script tag', () => {
      const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' })
      expect(out).not.toContain('<')
      expect(out).toContain('\\u003c/script>')
      expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script>' })
    })
  })
})

describe('buildBlogPosting', () => {
  const input = {
    headline: 'How to pick a carry-on',
    description: 'A short guide.',
    path: '/blog/how-to-pick-a-carry-on',
    datePublished: '2026-11-01T10:00:00.000Z',
    dateModified: '2026-11-05T10:00:00.000Z',
    section: 'Travel',
  }

  it('uses a Person author with name and sameAs, and the Organization as publisher', () => {
    const post = buildBlogPosting(ORIGIN, {
      ...input,
      author: { name: 'Real Person', sameAs: ['https://example.com/real-person'] },
    })
    expect(post['@type']).toBe('BlogPosting')
    expect(post).toMatchObject({
      headline: input.headline,
      url: `${ORIGIN}/blog/how-to-pick-a-carry-on`,
      mainEntityOfPage: `${ORIGIN}/blog/how-to-pick-a-carry-on`,
      datePublished: input.datePublished,
      dateModified: input.dateModified,
      articleSection: 'Travel',
      author: {
        '@type': 'Person',
        name: 'Real Person',
        sameAs: ['https://example.com/real-person'],
      },
      publisher: { '@type': 'Organization', name: 'DMDailyDeals' },
    })
    expect((post.image as string[])[0]).toMatch(/^https:\/\//)
  })

  it('falls back to the Organization without a byline and never adds AI or FAQ properties', () => {
    const post = buildBlogPosting(ORIGIN, { ...input, author: null })
    expect(post.author).toMatchObject({ '@type': 'Organization' })
    const json = serializeJsonLd(post)
    expect(json).not.toMatch(/aiAssisted|reviewedBy|FAQPage|isBasedOn|creativeWorkStatus/i)
  })
})
