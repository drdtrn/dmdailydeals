import React from 'react'

import { formatDateTimeET } from '@/lib/format'
import { cn } from '@/utilities/ui'

/**
 * "Price checked Nov 21, 9:14 AM ET". Absolute and formatted from the stored instant, so the
 * string is identical on every render and safe in cached pages.
 */
export function PriceChecked({ at, className }: { at?: string | null; className?: string }) {
  if (!at) return null
  const label = formatDateTimeET(at)
  if (!label) return null
  return (
    <p className={cn('text-[11px] text-subtle-foreground md:text-xs', className)}>
      Price checked <time dateTime={at}>{label}</time>
    </p>
  )
}
