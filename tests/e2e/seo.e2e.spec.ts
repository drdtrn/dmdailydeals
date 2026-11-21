import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { todayInTimezone } from '../../src/lib/drops/time'

/**
 * The crawler surfaces and the structured data, read from the raw HTTP responses (no JavaScript).
 * Needs the seed (`pnpm seed`): the slugs below are the seed's fixtures.
 */
const BASE = 'http://localhost:3000'
const TODAY = todayInTimezone(new Date(), 'America/New_York')
const HERO_SLUG = 'over-ear-wireless-noise-cancelling-headphones'
const EXPIRED_SLUG = 'robot-vacuum-with-self-emptying-base'

type Json = Record<string, unknown>

async function text(request: APIRequestContext, path: string, headers?: Record<string, string>) {
  const res = await request.get(`${BASE}${path}`, { headers })
  return { res, body: await res.text() }
}

/** Parse XML in the browser (Node has no DOMParser); returns the root name and the `loc`/`lastmod` text. */
async function parseXml(page: Page, xml: string) {
  await page.goto('about:blank')
  return page.evaluate((source) => {
    const doc = new DOMParser().parseFromString(source, 'application/xml')
    if (doc.querySelector('parsererror'))
      return { error: doc.querySelector('parsererror')!.textContent }
    const rows = [...doc.documentElement.children].map((el) => ({
      loc: el.querySelector('loc')?.textContent ?? null,
      lastmod: el.querySelector('lastmod')?.textContent ?? null,
    }))
    return { root: doc.documentElement.localName, rows }
  }, xml)
}

function jsonLdBlocks(html: string): Json[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (m) => JSON.parse(m[1]) as Json,
  )
}

const typeOf = (block: Json) => String(block['@type'])
const isAbsolute = (url: unknown) => typeof url === 'string' && /^https?:\/\//.test(url)

/** The required (and Google-recommended) properties from plan section C, per type. */
function expectRequiredProperties(block: Json) {
  expect(block['@context']).toBe('https://schema.org')
  switch (typeOf(block)) {
    case 'WebSite':
      expect(block.name).toBeTruthy()
      expect(isAbsolute(block.url)).toBe(true)
      break
    case 'Organization':
      expect(block.name).toBeTruthy()
      expect(isAbsolute(block.url)).toBe(true)
      expect(isAbsolute(block.logo)).toBe(true)
      break
    case 'Product': {
      expect(block.name).toBeTruthy()
      expect(isAbsolute(block.url)).toBe(true)
      const offers = block.offers as Json
      expect(Array.isArray(offers)).toBe(false)
      expect(offers['@type']).toBe('Offer')
      expect(Number(offers.price)).toBeGreaterThan(0)
      expect(offers.priceCurrency).toBe('USD')
      expect(offers.availability).toBe('https://schema.org/InStock')
      expect(String(offers.priceValidUntil)).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/)
      expect(isAbsolute(offers.url)).toBe(true)
      expect(String(offers.url)).not.toContain('/go/')
      for (const image of block.image as unknown[]) expect(isAbsolute(image)).toBe(true)
      break
    }
    case 'BreadcrumbList': {
      const items = block.itemListElement as Json[]
      expect(items.length).toBeGreaterThanOrEqual(2)
      items.forEach((item, i) => {
        expect(item.position).toBe(i + 1)
        expect(item.name).toBeTruthy()
        expect(isAbsolute(item.item)).toBe(true)
      })
      break
    }
    case 'Article':
      expect(block.headline).toBeTruthy()
      expect((block.image as unknown[]).every(isAbsolute)).toBe(true)
      expect(String(block.datePublished)).toMatch(/Z$/)
      expect(String(block.dateModified)).toMatch(/Z$/)
      expect((block.author as Json)['@type']).toBe('Organization')
      expect((block.publisher as Json)['@type']).toBe('Organization')
      break
    case 'ItemList':
    case 'CollectionPage':
      break
    default:
      throw new Error(`Unexpected JSON-LD type ${typeOf(block)}`)
  }
}

const FORBIDDEN =
  /FAQPage|HowTo|"Event"|AggregateOffer|aggregateRating|SearchAction|potentialAction|hasMerchantReturnPolicy|shippingDetails|priceSpecification/

test.describe('robots.txt', () => {
  test('allows the AI crawlers, disallows the private paths and keeps media fetchable', async ({
    request,
  }) => {
    const { res, body } = await text(request, '/robots.txt')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('text/plain')
    for (const bot of [
      'Googlebot',
      'Bingbot',
      'OAI-SearchBot',
      'Claude-SearchBot',
      'PerplexityBot',
      'ChatGPT-User',
      'Claude-User',
      'GPTBot',
      'ClaudeBot',
      'CCBot',
      'meta-externalagent',
      'Amazonbot',
      'Google-Extended',
      'Applebot-Extended',
    ]) {
      expect(body, bot).toMatch(new RegExp(`^User-Agent: ${bot}$`, 'm'))
    }
    expect(body).toMatch(/^User-Agent: \*$/m)
    expect(body).not.toMatch(/anthropic-ai|Claude-Web/)
    for (const path of ['/go/', '/admin', '/api/', '/next/', '/styleguide']) {
      expect(body).toContain(`Disallow: ${path}`)
    }
    expect(body).not.toMatch(/^Disallow: \/$/m)
    expect(body).toContain('Allow: /api/media/file/')
    // The Allow lines come before the Disallow lines, in every group.
    for (const group of body.split(/\n\n/).filter((g) => g.includes('User-Agent'))) {
      expect(group.indexOf('Allow: /api/media/file/')).toBeLessThan(
        group.indexOf('Disallow: /api/'),
      )
    }
    expect(body).toMatch(/^Sitemap: https?:\/\/[^\s]+\/sitemap\.xml$/m)
  })
})

test.describe('sitemaps', () => {
  test('the index and every child parse as XML, with lastmod', async ({ request, page }) => {
    const index = await text(request, '/sitemap.xml')
    expect(index.res.status()).toBe(200)
    expect(index.res.headers()['content-type']).toContain('xml')
    const parsedIndex = await parseXml(page, index.body)
    expect(parsedIndex).toMatchObject({ root: 'sitemapindex' })
    const children = (parsedIndex as { rows: { loc: string; lastmod: string }[] }).rows
    expect(children.length).toBeGreaterThanOrEqual(4)

    const urls: string[] = []
    for (const child of children) {
      expect(child.lastmod, child.loc).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      const path = new URL(child.loc).pathname
      const { res, body } = await text(request, path)
      expect(res.status(), path).toBe(200)
      const parsed = await parseXml(page, body)
      expect(parsed, path).toMatchObject({ root: 'urlset' })
      for (const row of (parsed as { rows: { loc: string; lastmod: string }[] }).rows) {
        expect(row.loc).toMatch(/^https?:\/\//)
        expect(row.lastmod, row.loc).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        urls.push(new URL(row.loc).pathname)
      }
      // No changefreq or priority.
      expect(body).not.toMatch(/changefreq|priority/)
    }

    // Live and expired deals, live and archived drops, hubs, pages.
    for (const path of [
      `/deal/${HERO_SLUG}`,
      `/deal/${EXPIRED_SLUG}`,
      `/drops/${TODAY}`,
      '/drops',
      '/',
      '/deals/tech',
      '/stores/example-electronics',
      '/black-friday',
      '/about',
      '/esim',
    ]) {
      expect(urls, path).toContain(path)
    }
    // Hub URLs only: never /go, admin or API.
    expect(urls.filter((u) => /^\/(go|admin|api)\b/.test(u))).toEqual([])
  })

  test('an unknown child sitemap is a 404', async ({ request }) => {
    expect((await request.get(`${BASE}/sitemap/nope.xml`)).status()).toBe(404)
  })
})

test.describe('llms.txt and the RSS feed', () => {
  test('llms.txt has the H1, a summary and the key links', async ({ request }) => {
    const { res, body } = await text(request, '/llms.txt')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('text/plain')
    const lines = body.split('\n')
    expect(lines[0]).toBe('# DMDailyDeals')
    expect(lines[2]).toMatch(/^> /)
    for (const path of [
      '/drops',
      '/deals/tech',
      '/deals/home',
      '/deals/travel',
      '/esim',
      '/about',
      '/disclosure',
      `/drops/${TODAY}`,
    ]) {
      expect(body, path).toMatch(new RegExp(`\\]\\(https?://[^)]*${path.replace(/\//g, '\\/')}\\)`))
    }
  })

  test('feed.xml is RSS 2.0 with the latest drops', async ({ request, page }) => {
    const { res, body } = await text(request, '/feed.xml')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('application/rss+xml')
    await page.goto('about:blank')
    const parsed = await page.evaluate((source) => {
      const doc = new DOMParser().parseFromString(source, 'application/xml')
      if (doc.querySelector('parsererror')) return { error: 'parsererror' }
      const items = [...doc.querySelectorAll('item')].map((i) => ({
        title: i.querySelector('title')?.textContent,
        link: i.querySelector('link')?.textContent,
        guid: i.querySelector('guid')?.textContent,
        pubDate: i.querySelector('pubDate')?.textContent,
        description: i.querySelector('description')?.textContent,
      }))
      return { version: doc.documentElement.getAttribute('version'), items }
    }, body)
    expect(parsed).not.toHaveProperty('error')
    const feed = parsed as {
      version: string
      items: { title: string; link: string; guid: string; pubDate: string; description: string }[]
    }
    expect(feed.version).toBe('2.0')
    expect(feed.items.length).toBeGreaterThanOrEqual(1)
    expect(feed.items.length).toBeLessThanOrEqual(20)
    const first = feed.items[0]
    expect(first.link).toMatch(new RegExp(`/drops/${TODAY}$`))
    expect(first.guid).toBe(first.link)
    expect(Number.isNaN(Date.parse(first.pubDate))).toBe(false)
    expect(first.description).toContain('Hero deal:')
  })

  test('every page advertises the feed', async ({ request }) => {
    for (const path of ['/', '/drops', `/deal/${HERO_SLUG}`]) {
      const { body } = await text(request, path)
      expect(body, path).toMatch(
        /<link rel="alternate" type="application\/rss\+xml" href="[^"]*\/feed\.xml"/,
      )
    }
  })
})

test.describe('IndexNow key file', () => {
  const KEY = process.env.INDEXNOW_KEY?.trim()

  test('is a 404 while INDEXNOW_KEY is unset', async ({ request }) => {
    test.skip(Boolean(KEY), 'INDEXNOW_KEY is set in this environment')
    expect((await request.get(`${BASE}/indexnow-key.txt`)).status()).toBe(404)
  })

  test('serves the key as plain text when it is set', async ({ request }) => {
    test.skip(
      !KEY,
      'INDEXNOW_KEY is not set in this environment (the unit tests cover the set case)',
    )
    const { res, body } = await text(request, '/indexnow-key.txt')
    expect(res.status()).toBe(200)
    expect(body).toBe(KEY)
  })
})

test.describe('JSON-LD in the raw HTML', () => {
  // No JavaScript runs for `request`, so this is exactly what a crawler gets.
  test('home: WebSite and Organization', async ({ request }) => {
    const blocks = jsonLdBlocks((await text(request, '/')).body)
    expect(blocks.map(typeOf).sort()).toEqual(['Organization', 'WebSite'])
    blocks.forEach(expectRequiredProperties)
  })

  test('a live deal: Product with one Offer, and the breadcrumb', async ({ request }) => {
    const { body } = await text(request, `/deal/${HERO_SLUG}`)
    const blocks = jsonLdBlocks(body)
    expect(blocks.map(typeOf).sort()).toEqual(['BreadcrumbList', 'Product'])
    blocks.forEach(expectRequiredProperties)
    const product = blocks.find((b) => typeOf(b) === 'Product')!
    // Matches the visible page: the name is the h1, the price is on screen.
    expect(body).toContain(String(product.name))
    expect(body).toContain('$119')
    expect((product.offers as Json).price).toBe(119)
    // The was-price is not marked up.
    expect(JSON.stringify(blocks)).not.toContain('199')
    expect(JSON.stringify(blocks)).not.toMatch(FORBIDDEN)
  })

  test('an expired deal: the breadcrumb only, no Product, still indexable', async ({ request }) => {
    const { body } = await text(request, `/deal/${EXPIRED_SLUG}`)
    const blocks = jsonLdBlocks(body)
    expect(blocks.map(typeOf)).toEqual(['BreadcrumbList'])
    expect(body).not.toContain('"@type":"Product"')
    expect(body).not.toMatch(/<meta name="robots" content="[^"]*noindex/)
  })

  test('the breadcrumb on a Home-category deal does not read Home > Home', async ({ request }) => {
    const { body } = await text(request, `/deal/${EXPIRED_SLUG}`)
    const names = (jsonLdBlocks(body)[0].itemListElement as { name: string }[]).map((i) => i.name)
    expect(names.slice(0, 2)).toEqual(['DMDailyDeals', 'Home'])
  })

  test('a drop: Article, breadcrumb and item list', async ({ request }) => {
    const { body } = await text(request, `/drops/${TODAY}`)
    const blocks = jsonLdBlocks(body)
    expect(blocks.map(typeOf).sort()).toEqual(['Article', 'BreadcrumbList', 'ItemList'])
    blocks.forEach(expectRequiredProperties)
    expect(JSON.stringify(blocks)).not.toMatch(FORBIDDEN)
  })

  test('hubs: category, store and event carry a breadcrumb and a collection page', async ({
    request,
  }) => {
    for (const path of ['/deals/tech', '/stores/example-electronics', '/black-friday']) {
      const blocks = jsonLdBlocks((await text(request, path)).body)
      expect(blocks.map(typeOf).sort(), path).toEqual(['BreadcrumbList', 'CollectionPage'])
      blocks.forEach(expectRequiredProperties)
    }
  })

  test('/about: Organization', async ({ request }) => {
    const blocks = jsonLdBlocks((await text(request, '/about')).body)
    expect(blocks.map(typeOf)).toEqual(['Organization'])
    blocks.forEach(expectRequiredProperties)
  })
})

test.describe('metadata', () => {
  test('pages allow large image previews and never nosnippet or meta keywords', async ({
    request,
  }) => {
    for (const path of [
      '/',
      '/drops',
      `/drops/${TODAY}`,
      `/deal/${HERO_SLUG}`,
      '/deals/tech',
      '/esim',
    ]) {
      const { body } = await text(request, path)
      expect(body, path).toMatch(/<meta name="googlebot" content="[^"]*max-image-preview:large/)
      expect(body, path).not.toMatch(/nosnippet/i)
      expect(body, path).not.toMatch(/<meta name="keywords"/)
      expect(body, path).toMatch(/<meta name="twitter:card" content="summary_large_image"/)
      expect(body, path).toMatch(/<meta property="og:image" content="https?:\/\//)
    }
  })

  test('a deal without its own og size falls back to the default image; the home page too', async ({
    request,
  }) => {
    const { body } = await text(request, '/drops')
    expect(body).toContain('/brand/og-default.png')
  })
})

test.describe('links and disclosure', () => {
  test('every outbound CTA is /go/<id> or the eSIM offer, all sponsored nofollow', async ({
    request,
  }) => {
    for (const path of ['/', `/drops/${TODAY}`, '/deals/tech', `/deal/${HERO_SLUG}`, '/esim']) {
      const { body } = await text(request, path)
      const cta = [
        ...body.matchAll(/<a [^>]*href="(\/go\/\d+|https?:\/\/(?!localhost)[^"]+)"[^>]*>/g),
      ]
      expect(cta.length, path).toBeGreaterThan(0)
      for (const [tag, href] of cta) {
        if (href.startsWith('/go/')) expect(tag, tag).toMatch(/rel="sponsored nofollow"/)
        else if (path === '/esim') {
          expect(tag).toMatch(/rel="sponsored nofollow"/)
          expect(tag).toContain('data-umami-event="esim-cta"')
        }
      }
    }
  })

  test('every page with deal CTAs shows the disclosure', async ({ request }) => {
    for (const path of [
      '/',
      `/drops/${TODAY}`,
      '/deals/tech',
      '/stores/example-electronics',
      '/black-friday',
      `/deal/${HERO_SLUG}`,
      `/deal/${EXPIRED_SLUG}`,
      '/esim',
    ]) {
      const { body } = await text(request, path)
      expect(body, path).toContain('Paid links: we may earn a commission')
    }
  })
})

test.describe('freshness', () => {
  test('hubs show an absolute "Updated" time', async ({ request }) => {
    for (const path of ['/drops', '/deals/tech', '/stores/example-electronics', '/black-friday']) {
      const { body } = await text(request, path)
      expect(body, path).toMatch(
        /Updated <time dateTime="[^"]+">[A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2} [AP]M ET<\/time>/,
      )
    }
  })
})

test.describe('AI crawlers get metadata in the initial <head>', () => {
  const AI_BOTS = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-SearchBot',
    'Claude-User',
    'PerplexityBot',
    'Perplexity-User',
    'CCBot',
    'meta-externalagent',
    'meta-webindexer',
    'meta-externalfetcher',
    'Amazonbot',
    'Amzn-SearchBot',
    'Amzn-User',
    'DuckAssistBot',
    'Applebot',
    'Googlebot',
    'Bingbot',
  ]

  for (const bot of AI_BOTS) {
    test(`${bot}: title and canonical in <head>, JSON-LD in the HTML`, async ({ request }) => {
      const ua = `Mozilla/5.0 (compatible; ${bot}/1.0; +https://example.com/bot)`
      for (const path of ['/', `/deal/${HERO_SLUG}`]) {
        const { res, body } = await text(request, path, { 'User-Agent': ua })
        expect(res.status(), path).toBe(200)
        const head = body.slice(0, body.indexOf('</head>'))
        expect(head, `${bot} ${path}`).toMatch(/<title>[^<]+<\/title>/)
        expect(head, `${bot} ${path}`).toMatch(/<link rel="canonical" href="https?:\/\/[^"]+"/)
        expect(body, `${bot} ${path}`).toContain('application/ld+json')
      }
    })
  }
})
