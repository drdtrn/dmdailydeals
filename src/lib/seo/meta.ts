import type { Metadata } from 'next'

import type { Media } from '@/payload-types'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'

import { DEFAULT_OG_IMAGE_PATH, RSS_PATH, SITE_NAME } from './site'

/** Robots directives for an indexable page. Never `nosnippet`; large image previews allowed. */
export const INDEXABLE_ROBOTS: NonNullable<Metadata['robots']> = {
  index: true,
  follow: true,
  googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
}

/** Thin or utility pages: kept out of the index, links still followed. */
export const NOINDEX_ROBOTS: NonNullable<Metadata['robots']> = { index: false, follow: true }

/** The RSS feed advertised in every page's `<head>`. */
export const FEED_ALTERNATES = {
  types: { 'application/rss+xml': [{ url: RSS_PATH, title: `${SITE_NAME} drops` }] },
}

type OgImage = { src: string; width: number; height: number; alt: string }

/** The media's own `og` (1200x630) size, only when it exists; otherwise null (use the default). */
export function ogImageOf(media: Media | number | null | undefined): OgImage | null {
  if (!media || typeof media !== 'object') return null
  const og = media.sizes?.og
  if (!og?.url || !og.width || !og.height) return null
  return { src: og.url, width: og.width, height: og.height, alt: media.alt || '' }
}

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
 * Per-page metadata: title, description, canonical, robots, Open Graph, Twitter and the RSS link.
 * Each key replaces the root layout's, so every page restates robots, twitter and alternates.
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
  const og = ogImageOf(image)
  const fullTitle = absoluteTitle ? title : `${title} · ${SITE_NAME}`
  return {
    title: absoluteTitle ? { absolute: title } : title,
    ...(desc ? { description: desc } : {}),
    alternates: { canonical: path, ...FEED_ALTERNATES },
    openGraph: mergeOpenGraph({
      type,
      title: fullTitle,
      ...(desc ? { description: desc } : {}),
      url: path,
      ...(og ? { images: [{ url: og.src, width: og.width, height: og.height, alt: og.alt }] } : {}),
    }),
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      ...(desc ? { description: desc } : {}),
      images: [
        og
          ? { url: og.src, width: og.width, height: og.height, alt: og.alt }
          : { url: DEFAULT_OG_IMAGE_PATH, alt: SITE_NAME },
      ],
    },
    robots: noindex ? NOINDEX_ROBOTS : INDEXABLE_ROBOTS,
  }
}
