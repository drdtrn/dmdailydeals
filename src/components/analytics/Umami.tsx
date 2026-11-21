import Script from 'next/script'
import React from 'react'

import { isLocalHost } from '@/lib/seo/indexnow'

export type UmamiConfig = { src: string; websiteId: string; domains?: string }

type Env = Record<string, string | undefined>

/**
 * Umami settings from the environment, or null when analytics is not configured (the script is
 * then not rendered at all). `src` must be an https URL, or http for a local Umami.
 *
 * `data-domains` makes the tracker do nothing on any other hostname, so local development, preview
 * deployments and anyone who copies the page never pollute the numbers. It defaults to the host of
 * `NEXT_PUBLIC_SERVER_URL` (the production site), and is left out when that is local, so a local
 * Umami can still be tried. `NEXT_PUBLIC_UMAMI_DOMAINS` (comma separated) overrides it, e.g. to
 * include a `www.` host.
 */
export function getUmamiConfig(env: Env): UmamiConfig | null {
  const src = env.NEXT_PUBLIC_UMAMI_SRC?.trim()
  const websiteId = env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim()
  if (!src || !websiteId) return null
  try {
    const url = new URL(src)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  } catch {
    return null
  }

  let domains = env.NEXT_PUBLIC_UMAMI_DOMAINS?.trim()
  if (!domains && env.NEXT_PUBLIC_SERVER_URL) {
    try {
      const host = new URL(env.NEXT_PUBLIC_SERVER_URL).hostname
      if (!isLocalHost(host)) domains = host
    } catch {
      // No usable site URL: leave the tracker unrestricted.
    }
  }
  return { src, websiteId, ...(domains ? { domains } : {}) }
}

/**
 * The Umami tracker, loaded after hydration so it never delays rendering. Cookieless.
 * Custom events are sent from `data-umami-event` attributes and `window.umami.track`.
 */
export function UmamiScript({ config }: { config?: UmamiConfig | null }) {
  // NEXT_PUBLIC_* values are inlined when the app is built, so they must be set at build time.
  const resolved =
    config === undefined
      ? getUmamiConfig({
          NEXT_PUBLIC_UMAMI_SRC: process.env.NEXT_PUBLIC_UMAMI_SRC,
          NEXT_PUBLIC_UMAMI_WEBSITE_ID: process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
          NEXT_PUBLIC_UMAMI_DOMAINS: process.env.NEXT_PUBLIC_UMAMI_DOMAINS,
          NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
        })
      : config
  if (!resolved) return null
  return (
    <Script
      id="umami"
      src={resolved.src}
      data-website-id={resolved.websiteId}
      {...(resolved.domains ? { 'data-domains': resolved.domains } : {})}
      strategy="afterInteractive"
    />
  )
}
