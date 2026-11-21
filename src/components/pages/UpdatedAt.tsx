import React from 'react'

import { formatDateTimeET } from '@/lib/format'
import { cn } from '@/utilities/ui'

/**
 * "Updated Nov 21, 9:14 AM ET" for hub pages. Absolute and formatted from the stored instant (like
 * "Price checked"), so a cached page never says "2 hours ago" for days.
 */
export function UpdatedAt({ at, className }: { at?: string | null; className?: string }) {
  if (!at) return null
  const label = formatDateTimeET(at)
  if (!label) return null
  return (
    <p className={cn('text-xs text-subtle-foreground md:text-[13px]', className)}>
      Updated <time dateTime={at}>{label}</time>
    </p>
  )
}
