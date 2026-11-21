import type { Media } from '@/payload-types'

import { getMediaUrl } from '@/utilities/getMediaUrl'

export type ResolvedImage = { src: string; width: number; height: number; alt: string }

/**
 * Pick a usable image from a populated Payload media doc. Keeps the URL relative (e.g.
 * /api/media/file/x.jpg) so next/image treats it as local (see images.localPatterns).
 * Returns null for an id (unpopulated relation) or a media doc without a URL.
 */
export function resolveImage(
  media: Media | number | null | undefined,
  size: 'card' | 'hero' | 'og' | 'original' = 'original',
  fallbackAlt = '',
): ResolvedImage | null {
  if (!media || typeof media !== 'object') return null
  const variant = size === 'original' ? undefined : media.sizes?.[size]
  const url = variant?.url || media.url
  if (!url) return null
  const width = variant?.url ? variant.width : media.width
  const height = variant?.url ? variant.height : media.height
  if (!width || !height) return null
  return {
    src: getMediaUrl(url, media.updatedAt),
    width,
    height,
    alt: media.alt || fallbackAlt,
  }
}
