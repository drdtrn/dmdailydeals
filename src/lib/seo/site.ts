import { getServerSideURL } from '@/utilities/getURL'

export const SITE_NAME = 'DMDailyDeals'
export const SITE_TAGLINE =
  'A fresh set of curated deals across home, tech and travel, every day at 9:00 AM ET.'

/** The public origin, without a trailing slash. */
export function siteOrigin(): string {
  return getServerSideURL().replace(/\/+$/, '')
}

/** Absolute URL for a site path ("/deal/x") or an already absolute URL (returned unchanged). */
export function absoluteUrl(pathOrUrl: string, origin: string = siteOrigin()): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  return `${origin}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`
}

/** The label of the first breadcrumb. "Home" would read "Home > Home" on the Home category. */
export const ROOT_CRUMB = { label: SITE_NAME, href: '/' } as const

export const RSS_PATH = '/feed.xml'
export const DEFAULT_OG_IMAGE_PATH = '/brand/og-default.png'
export const LOGO_PATH = '/brand/dm-monogram-black.png'
