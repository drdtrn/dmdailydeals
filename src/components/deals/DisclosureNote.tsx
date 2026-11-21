import Link from 'next/link'
import React from 'react'

import { cn } from '@/utilities/ui'

/** Affiliate disclosure, placed right next to any outbound CTA or list of deals. */
export function DisclosureNote({ className }: { className?: string }) {
  return (
    <p className={cn('text-xs text-subtle-foreground md:text-[13px]', className)}>
      Paid links: we may earn a commission when you buy through links on this page.{' '}
      <Link href="/disclosure" className="text-foreground underline underline-offset-2">
        Affiliate disclosure
      </Link>
    </p>
  )
}
