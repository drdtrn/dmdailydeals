import { newestEntryDate, renderSitemapIndex } from '@/lib/seo/sitemapIndex'
import { SITEMAP_IDS, sitemapEntries, sitemapPath } from '@/lib/seo/sitemap'
import { absoluteUrl } from '@/lib/seo/site'

/** The sitemap index. Dynamic: it reads each child to give it an accurate `lastmod`. */
export const dynamic = 'force-dynamic'

export async function GET() {
  const children = await Promise.all(
    SITEMAP_IDS.map(async (id) => {
      const entries = await sitemapEntries(id)
      return { id, count: entries.length, lastModified: newestEntryDate(entries) }
    }),
  )
  // An empty child (no posts yet) is left out of the index; its URL still answers.
  const xml = renderSitemapIndex(
    children
      .filter((c) => c.count > 0)
      .map((c) => ({ loc: absoluteUrl(sitemapPath(c.id)), lastModified: c.lastModified })),
  )
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
