import { listFeedDrops } from '@/lib/data/seo'
import { renderRss } from '@/lib/seo/rss'
import { siteOrigin } from '@/lib/seo/site'

/** Reads Payload, so it is never prerendered at build time. */
export const dynamic = 'force-dynamic'

export async function GET() {
  const drops = await listFeedDrops(20)
  return new Response(renderRss(siteOrigin(), drops), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
