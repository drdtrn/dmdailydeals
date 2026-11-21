import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { CategoryNav } from '@/components/deals/CategoryNav'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/utilities/ui'

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <div className="container py-16 md:py-28">
      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Error 404</p>
      <h1 className="mt-3 font-display text-5xl leading-[1.05] font-medium md:text-7xl">
        This page isn’t here
      </h1>
      <p className="mt-5 max-w-[52ch] text-soft-foreground md:text-lg">
        The link may be old, or the deal may have been removed. Today’s drop and the archive are the
        best places to find what is live.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className={buttonVariants({ size: 'lg' })}>
          Today’s drop
        </Link>
        <Link href="/drops" className={cn(buttonVariants({ size: 'lg', variant: 'outline' }))}>
          Browse the archive
        </Link>
      </div>
      <CategoryNav className="mt-10" label="Browse by category" />
    </div>
  )
}
