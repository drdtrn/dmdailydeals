import React from 'react'

import { formatLongDate, formatShortDate } from '@/lib/format'
import { cn } from '@/utilities/ui'

type Props = {
  /** ISO instant of the drop being shown (used for the date line). */
  dropDate: string
  /** Optional issue number, shown as "No. 042". */
  issueNumber?: number
  /** Usually <Countdown target=... />. */
  countdown: React.ReactNode
  /** Usually <HeroDeal ... />. */
  children: React.ReactNode
  className?: string
}

/**
 * The light stone hero band that carries the drop: drop meta, the countdown, and the hero deal.
 * Energy comes from scale and type (large Bodoni digits), not from darkness.
 */
export function HeroBand({ dropDate, issueNumber, countdown, children, className }: Props) {
  const issue = issueNumber ? ` · No. ${String(issueNumber).padStart(3, '0')}` : ''
  return (
    <section
      aria-label="Today's drop"
      className={cn(
        'bg-gradient-to-b from-panel to-panel-end pb-8 text-foreground md:pb-14',
        className,
      )}
    >
      <div className="container">
        <div className="flex items-baseline justify-between pt-5 text-xs tracking-[0.14em] text-muted-foreground uppercase md:hidden">
          <span>Today&rsquo;s drop{issue}</span>
          <span>{formatShortDate(dropDate)}</span>
        </div>

        <div className="mt-[18px] flex flex-wrap items-end justify-between gap-x-12 gap-y-6 border-y border-border py-5 pb-[22px] md:mt-0 md:border-t-0 md:py-9 md:pb-8">
          <div className="w-full md:w-auto">{countdown}</div>
          <div className="hidden text-right md:block">
            <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
              Today&rsquo;s drop{issue}
            </p>
            <p className="mt-1.5 font-display text-[26px] italic">{formatLongDate(dropDate)}</p>
          </div>
        </div>

        <div className="mt-6 md:mt-11">{children}</div>
      </div>
    </section>
  )
}
