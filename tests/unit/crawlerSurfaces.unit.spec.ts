import { describe, expect, it } from 'vitest'

import robots from '../../src/app/robots'
import { AI_HTML_LIMITED_BOTS, TRAINING_CRAWLERS } from '@/lib/seo/crawlers'
import { renderLlmsTxt } from '@/lib/seo/llms'
import { describeDrop, renderRss } from '@/lib/seo/rss'
import { newestEntryDate, renderSitemapIndex } from '@/lib/seo/sitemapIndex'

describe('robots', () => {
  const result = robots()
  const rules = (Array.isArray(result.rules) ? result.rules : [result.rules]) as {
    userAgent: string | string[]
    allow: string[]
    disallow: string[]
  }[]
  const agents = rules.flatMap((r) => [r.userAgent].flat())

  it('allows every training crawler (decision D7) and never names outdated bots', () => {
    for (const bot of TRAINING_CRAWLERS) expect(agents).toContain(bot)
    expect(agents).not.toContain('anthropic-ai')
    expect(agents).not.toContain('Claude-Web')
    for (const rule of rules) expect(rule.disallow).not.toContain('/')
  })

  it('gives every group the same disallows and the media allow', () => {
    for (const rule of rules) {
      expect(rule.disallow).toEqual(['/go/', '/admin', '/api/', '/next/', '/styleguide'])
      expect(rule.allow).toEqual(['/', '/api/media/file/'])
    }
    expect(agents).toContain('*')
  })

  it('points to the sitemap index', () => {
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/)
  })
})

describe('htmlLimitedBots additions', () => {
  it('lists the AI crawlers that fetch pages, not the robots-only tokens', () => {
    expect(AI_HTML_LIMITED_BOTS).toContain('GPTBot')
    expect(AI_HTML_LIMITED_BOTS).toContain('ClaudeBot')
    expect(AI_HTML_LIMITED_BOTS).toContain('PerplexityBot')
    expect(AI_HTML_LIMITED_BOTS).toHaveLength(17)
  })
})

describe('sitemap index', () => {
  it('renders a sitemapindex with escaped locs and lastmod', () => {
    const xml = renderSitemapIndex([
      {
        loc: 'https://x.test/sitemap/deals.xml?a=1&b=2',
        lastModified: new Date('2026-11-21T10:00:00Z'),
      },
      { loc: 'https://x.test/sitemap/posts.xml', lastModified: null },
    ])
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('deals.xml?a=1&amp;b=2')
    expect(xml).toContain('<lastmod>2026-11-21T10:00:00.000Z</lastmod>')
    expect(xml.match(/<lastmod>/g)).toHaveLength(1)
  })

  it('finds the newest lastModified', () => {
    expect(
      newestEntryDate([
        { url: 'a', lastModified: new Date('2026-01-01') },
        { url: 'b' },
        { url: 'c', lastModified: new Date('2026-03-01') },
      ])?.toISOString(),
    ).toBe('2026-03-01T00:00:00.000Z')
    expect(newestEntryDate([{ url: 'a' }])).toBeNull()
  })
})

describe('llms.txt', () => {
  const text = renderLlmsTxt({
    origin: 'https://x.test',
    today: { title: "Today's drop: Saturday", path: '/drops/2026-11-21', note: 'hero deal: Lamp' },
    categories: [{ title: 'Tech', slug: 'tech' }],
    posts: [{ title: 'eSIM guide', slug: 'esim-guide' }],
    drops: [{ label: 'Friday', slug: '2026-11-20', heroTitle: 'Kettle' }],
  })

  it('starts with the H1 and a > summary, then H2 link lists', () => {
    const lines = text.split('\n')
    expect(lines[0]).toBe('# DMDailyDeals')
    expect(lines[2]).toMatch(/^> /)
    expect(text).toMatch(/^## /m)
  })

  it('links to the required pages with absolute URLs', () => {
    for (const path of [
      '/',
      '/drops',
      '/deals/tech',
      '/esim',
      '/about',
      '/disclosure',
      '/drops/2026-11-21',
      '/blog/esim-guide',
      '/drops/2026-11-20',
    ]) {
      expect(text).toContain(`](https://x.test${path})`)
    }
  })
})

describe('RSS', () => {
  const item = {
    slug: '2026-11-21',
    date: '2026-11-21T12:00:00.000Z',
    publishAt: '2026-11-21T14:00:00.000Z',
    intro: 'Fish & chips <deal>',
    hero: { title: 'Headphones', price: 149.99, currency: 'USD' },
    picks: [{ title: 'Lamp', price: 20, currency: 'USD' }],
  }

  it('describes the hero and the picks', () => {
    expect(describeDrop(item)).toBe(
      'Fish & chips <deal> Hero deal: Headphones ($149.99). Picks: Lamp ($20).',
    )
  })

  it('renders RSS 2.0 with guid, RFC 822 pubDate and escaped text', () => {
    const xml = renderRss('https://x.test', [item])
    expect(xml).toContain('<rss version="2.0"')
    expect(xml).toContain('<guid isPermaLink="true">https://x.test/drops/2026-11-21</guid>')
    expect(xml).toContain('<pubDate>Sat, 21 Nov 2026 14:00:00 GMT</pubDate>')
    expect(xml).toContain('Fish &amp; chips &lt;deal&gt;')
    expect(xml).not.toContain('<deal>')
  })
})
