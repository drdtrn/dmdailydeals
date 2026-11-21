import { formatFullDate, formatPrice } from '@/lib/format'

import { escapeXml } from './sitemapIndex'
import { absoluteUrl, SITE_NAME, SITE_TAGLINE } from './site'

type FeedDeal = { title: string; price: number; currency: string }

export type FeedItemInput = {
  slug: string
  date: string
  publishAt: string
  intro?: string | null
  hero: FeedDeal | null
  picks: FeedDeal[]
}

const deal = (d: FeedDeal) => `${d.title} (${formatPrice(d.price, d.currency)})`

/** Plain-text description: the hero first, then the picks. (Escaped, not HTML.) */
export function describeDrop(item: FeedItemInput): string {
  const parts: string[] = []
  if (item.intro?.trim()) parts.push(item.intro.trim())
  if (item.hero) parts.push(`Hero deal: ${deal(item.hero)}.`)
  if (item.picks.length > 0) parts.push(`Picks: ${item.picks.map(deal).join('; ')}.`)
  return parts.join(' ')
}

/** RFC 822 date, as RSS 2.0 requires. */
export const rfc822 = (iso: string) => new Date(iso).toUTCString()

/** RSS 2.0 feed of drops, newest first. */
export function renderRss(
  origin: string,
  items: FeedItemInput[],
  lastBuild?: string | null,
): string {
  const self = absoluteUrl('/feed.xml', origin)
  const rows = items.map((item) => {
    const link = absoluteUrl(`/drops/${item.slug}`, origin)
    const heroNote = item.hero ? `: ${item.hero.title}` : ''
    return [
      '    <item>',
      `      <title>${escapeXml(`Deals of ${formatFullDate(`${item.slug}T12:00:00Z`)}${heroNote}`)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
      `      <pubDate>${rfc822(item.publishAt)}</pubDate>`,
      `      <description>${escapeXml(describeDrop(item))}</description>`,
      '    </item>',
    ].join('\n')
  })
  const newest = lastBuild ?? items[0]?.publishAt
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(`${SITE_NAME}: daily deal drops`)}</title>`,
    `    <link>${escapeXml(absoluteUrl('/', origin))}</link>`,
    `    <description>${escapeXml(SITE_TAGLINE)}</description>`,
    '    <language>en-us</language>',
    ...(newest ? [`    <lastBuildDate>${rfc822(newest)}</lastBuildDate>`] : []),
    `    <atom:link href="${escapeXml(self)}" rel="self" type="application/rss+xml" />`,
    ...rows,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}
