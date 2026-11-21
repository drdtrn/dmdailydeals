import type { MetadataRoute } from 'next'

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** The newest `lastModified` in a sitemap, or null when none has one. */
export function newestEntryDate(entries: MetadataRoute.Sitemap): Date | null {
  let best: Date | null = null
  for (const e of entries) {
    if (!e.lastModified) continue
    const d = new Date(e.lastModified)
    if (Number.isNaN(d.getTime())) continue
    if (!best || d > best) best = d
  }
  return best
}

/** A sitemap index document (sitemaps.org). */
export function renderSitemapIndex(items: { loc: string; lastModified: Date | null }[]): string {
  const rows = items
    .map(
      (i) =>
        `  <sitemap>\n    <loc>${escapeXml(i.loc)}</loc>${
          i.lastModified ? `\n    <lastmod>${i.lastModified.toISOString()}</lastmod>` : ''
        }\n  </sitemap>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</sitemapindex>\n`
}
