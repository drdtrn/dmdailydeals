import React from 'react'

import { DealCard } from '@/components/deals/DealCard'
import type { Deal } from '@/payload-types'
import { cn } from '@/utilities/ui'

type Props = {
  deals: Deal[]
  /** "Lowest in 90 days" flags by deal id (from `getLowestFlags`). */
  lowest?: Record<string, boolean>
  headingLevel?: 'h2' | 'h3' | 'h4'
  /** How many leading cards load their image eagerly (the first row). */
  eagerCount?: number
  /** Accessible name for the list. */
  label: string
  className?: string
}

/** The standard deal card grid: two columns on a phone, up to four on desktop. */
export function DealGrid({
  deals,
  lowest = {},
  headingLevel = 'h3',
  eagerCount = 0,
  label,
  className,
}: Props) {
  if (deals.length === 0) return null
  return (
    <ul
      aria-label={label}
      className={cn(
        'grid grid-cols-2 gap-x-3.5 gap-y-6 md:grid-cols-3 md:gap-x-6 md:gap-y-9 lg:grid-cols-4',
        className,
      )}
    >
      {deals.map((deal, index) => (
        <li key={deal.id} className="min-w-0">
          <DealCard
            deal={deal}
            lowestIn90Days={Boolean(lowest[String(deal.id)])}
            eager={index < eagerCount}
            headingLevel={headingLevel}
            className="h-full"
          />
        </li>
      ))}
    </ul>
  )
}
