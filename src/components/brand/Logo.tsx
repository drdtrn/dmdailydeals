import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import { cn } from '@/utilities/ui'

/**
 * The one place the brand marks are rendered. Placeholder PNGs for now; when the SVGs arrive,
 * swap the two <Image> elements below (and delete the `tone` assets) without touching callers.
 *
 * tone:
 *   - "paper": white marks, for use on ink (the header, the hero band)
 *   - "ink":   black marks, for use on paper
 *   - "auto":  black marks that invert in dark mode (the footer)
 */
export type LogoTone = 'ink' | 'paper' | 'auto'
export type LogoVariant = 'lockup' | 'monogram'

type Props = {
  tone?: LogoTone
  variant?: LogoVariant
  /** Wrap in a link to the home page (adds the accessible name). */
  href?: string
  /** Prioritise loading (above-the-fold logo). */
  eager?: boolean
  className?: string
}

const FILES = {
  monogram: { ink: '/brand/dm-monogram-black.png', paper: '/brand/dm-monogram-white.png' },
  wordmark: { ink: '/brand/dm-wordmark-black.png', paper: '/brand/dm-wordmark-white.png' },
} as const

export function Logo({ tone = 'auto', variant = 'lockup', href, eager = false, className }: Props) {
  const file = tone === 'paper' ? 'paper' : 'ink'
  const filterClass = tone === 'auto' ? 'logo-auto' : undefined

  const marks = (
    <>
      <Image
        src={FILES.monogram[file]}
        alt=""
        width={88}
        height={84}
        loading={eager ? 'eager' : undefined}
        className={cn('block h-[38px] w-auto md:h-11', filterClass)}
      />
      {variant === 'lockup' ? (
        <Image
          src={FILES.wordmark[file]}
          alt=""
          width={230}
          height={22}
          loading={eager ? 'eager' : undefined}
          className={cn('block h-[11px] w-auto md:h-[13px]', filterClass)}
        />
      ) : null}
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        aria-label="DMDailyDeals home"
        className={cn('inline-flex items-center gap-3 md:gap-3.5', className)}
      >
        {marks}
      </Link>
    )
  }

  return (
    <span
      role="img"
      aria-label="DMDailyDeals"
      className={cn('inline-flex items-center gap-3 md:gap-3.5', className)}
    >
      {marks}
    </span>
  )
}
