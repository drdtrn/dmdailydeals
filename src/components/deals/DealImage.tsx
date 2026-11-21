import { Headphones, House, Luggage, Monitor, Tag, type LucideIcon } from 'lucide-react'
import Image from 'next/image'
import React from 'react'

import { resolveImage } from '@/lib/media'
import type { Media } from '@/payload-types'
import { cn } from '@/utilities/ui'

const ICONS: Record<string, LucideIcon> = {
  home: House,
  tech: Monitor,
  travel: Luggage,
  audio: Headphones,
}

type Props = {
  image?: Media | number | null
  alt: string
  /** Category slug, picks the placeholder glyph when there is no photo. */
  categorySlug?: string
  /** next/image `sizes` for the slot this image fills. */
  sizes: string
  /** Above-the-fold LCP image: emits a <link rel="preload"> in the head. */
  preload?: boolean
  /** Load eagerly without a head preload (first row of cards). */
  eager?: boolean
  /** Which Payload size to request (card = 640x480, hero = 1600w). */
  size?: 'card' | 'hero'
  /** Muted treatment for expired / sold-out deals. */
  muted?: boolean
  iconClassName?: string
  className?: string
  children?: React.ReactNode
}

/** The image well: product photo (next/image) or a category glyph, plus overlay children (badges). */
export function DealImage({
  image,
  alt,
  categorySlug,
  sizes,
  preload,
  eager,
  size = 'card',
  muted,
  iconClassName,
  className,
  children,
}: Props) {
  const resolved = resolveImage(image, size, alt)
  const Icon = (categorySlug && ICONS[categorySlug]) || Tag

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-md bg-surface',
        className,
      )}
    >
      {resolved ? (
        <Image
          src={resolved.src}
          alt={alt}
          fill
          sizes={sizes}
          preload={preload}
          loading={eager && !preload ? 'eager' : undefined}
          className={cn('object-cover', muted && 'opacity-60 grayscale')}
        />
      ) : (
        <Icon
          aria-hidden="true"
          strokeWidth={0.75}
          className={cn('size-14 text-subtle-foreground md:size-[72px]', iconClassName)}
        />
      )}
      {children}
    </div>
  )
}
