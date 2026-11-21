import type { Metadata } from 'next'

import type { Media } from '@/payload-types'

import { resolveImage } from '@/lib/media'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'

const SITE_NAME = 'DMDailyDeals'

type Args = {
  /** Page title without the site name (the root layout's title template adds " · DMDailyDeals"). */
  title: string
  description?: string | null
  /** Canonical path, e.g. "/deal/some-slug" or "/drops?page=2". Resolved against `metadataBase`. */
  path: string
  /** A Payload media doc for the Open Graph image; the default OG image is used without one. */
  image?: Media | number | null
  type?: 'website' | 'article'
  /** Use the title exactly as given, without the template (home page). */
  absoluteTitle?: boolean
  noindex?: boolean
}

/** Trim to a sensible meta-description length without cutting a word in half. */
export function clipDescription(text: string | null | undefined, max = 160): string | undefined {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return undefined
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 80)).replace(/[\s,.;:]+$/, '')}…`
}

/**
 * Basic per-page metadata: title, description, canonical, Open Graph and Twitter. (JSON-LD, robots
 * rules and sitemaps are the SEO layer's job in Phase 6.)
 */
export function pageMetadata({
  title,
  description,
  path,
  image,
  type = 'website',
  absoluteTitle,
  noindex,
}: Args): Metadata {
  const desc = clipDescription(description)
  const og = resolveImage(image, 'og')
  const fullTitle = absoluteTitle ? title : `${title} · ${SITE_NAME}`
  return {
    title: absoluteTitle ? { absolute: title } : title,
    ...(desc ? { description: desc } : {}),
    alternates: { canonical: path },
    openGraph: mergeOpenGraph({
      type,
      title: fullTitle,
      ...(desc ? { description: desc } : {}),
      url: path,
      ...(og ? { images: [{ url: og.src, width: og.width, height: og.height, alt: og.alt }] } : {}),
    }),
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  }
}
