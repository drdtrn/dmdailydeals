import { SITE_NAME } from './site'

type Link = { title: string; path: string; note?: string }

export type LlmsInput = {
  origin: string
  today?: { title: string; path: string; note?: string } | null
  categories: { title: string; slug: string }[]
  posts: { title: string; slug: string }[]
  drops: { label: string; slug: string; heroTitle?: string | null }[]
}

const line = (origin: string, l: Link) =>
  `- [${l.title}](${origin}${l.path})${l.note ? `: ${l.note}` : ''}`

function section(origin: string, title: string, links: Link[]): string[] {
  return links.length === 0 ? [] : ['', `## ${title}`, '', ...links.map((l) => line(origin, l))]
}

/**
 * llms.txt: H1 site name, a `>` summary, then H2 link lists (llmstxt.org). Google Search does not
 * use it and no AI vendor has confirmed reading it; it is cheap, so it is here.
 */
export function renderLlmsTxt({ origin, today, categories, posts, drops }: LlmsInput): string {
  const lines: string[] = [
    `# ${SITE_NAME}`,
    '',
    '> DMDailyDeals publishes one drop of curated deals every day at 9:00 AM ET: a hero deal plus 5 to 10 picks across home, tech and travel, each with its price history checked. Every deal has its own page that stays online after the offer ends.',
    '',
    'Links to stores are paid (affiliate) links: we may earn a commission when you buy. Prices are in USD and show when they were last checked.',
    ...section(origin, 'Today', [
      ...(today ? [today] : []),
      { title: 'Home', path: '/', note: "today's drop with a countdown to the next one" },
    ]),
    ...section(origin, 'Deals', [
      { title: 'Drop archive', path: '/drops', note: 'every past drop, newest first' },
      ...categories.map((c) => ({
        title: `${c.title} deals`,
        path: `/deals/${c.slug}`,
        note: `live ${c.title.toLowerCase()} deals and recent drops`,
      })),
      { title: 'eSIM', path: '/esim', note: 'the offer that never expires' },
    ]),
    ...section(
      origin,
      'Latest drops',
      drops.map((d) => ({
        title: d.label,
        path: `/drops/${d.slug}`,
        ...(d.heroTitle ? { note: `hero: ${d.heroTitle}` } : {}),
      })),
    ),
    ...section(
      origin,
      'Guides',
      posts.map((p) => ({ title: p.title, path: `/blog/${p.slug}` })),
    ),
    ...section(origin, 'About', [
      { title: 'About', path: '/about', note: 'who runs the site and how deals are picked' },
      { title: 'Affiliate disclosure', path: '/disclosure', note: 'how we earn money' },
    ]),
    ...section(origin, 'Optional', [
      { title: 'RSS feed of drops', path: '/feed.xml' },
      { title: 'Sitemap', path: '/sitemap.xml' },
    ]),
  ]
  return `${lines.join('\n')}\n`
}
