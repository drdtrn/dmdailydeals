import { getCurrentDrop } from '@/lib/data/drops'
import { listCategories, listFeedDrops, listSitemapPosts } from '@/lib/data/seo'
import { formatFullDate } from '@/lib/format'
import { renderLlmsTxt } from '@/lib/seo/llms'
import { siteOrigin } from '@/lib/seo/site'

/** Reads Payload, so it is never prerendered at build time. */
export const dynamic = 'force-dynamic'

export async function GET() {
  const [current, categories, posts, drops] = await Promise.all([
    getCurrentDrop(),
    listCategories(),
    listSitemapPosts(10),
    listFeedDrops(10),
  ])
  const body = renderLlmsTxt({
    origin: siteOrigin(),
    today: current
      ? {
          title: `Today's drop: ${formatFullDate(`${current.drop.slug}T12:00:00Z`)}`,
          path: `/drops/${current.drop.slug}`,
          ...(current.hero ? { note: `hero deal: ${current.hero.title}` } : {}),
        }
      : null,
    categories,
    posts: posts.map((p) => ({ title: p.title, slug: p.slug })),
    drops: drops.map((d) => ({
      label: formatFullDate(`${d.slug}T12:00:00Z`),
      slug: d.slug,
      heroTitle: d.hero?.title,
    })),
  })
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
