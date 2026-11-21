import type { MetadataRoute } from 'next'
import { notFound } from 'next/navigation'

import { isSitemapId, SITEMAP_IDS, sitemapEntries } from '@/lib/seo/sitemap'

/**
 * Child sitemaps at /sitemap/<id>.xml (Next serves `generateSitemaps` output there and does NOT
 * create an index: `/sitemap.xml` is a rewrite to `app/sitemap-index.xml/route.ts`, see next.config.ts). The ids are static and the
 * handler is dynamic, so the build never touches the database.
 */
export const dynamic = 'force-dynamic'

export async function generateSitemaps() {
  return SITEMAP_IDS.map((id) => ({ id }))
}

export default async function sitemap(props: {
  id: Promise<string>
}): Promise<MetadataRoute.Sitemap> {
  // Next 16 passes the id as a Promise<string>; ours are names, not numbers.
  const id = await props.id
  if (!isSitemapId(id)) notFound()
  return sitemapEntries(id)
}
