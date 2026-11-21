'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

import { formatDropAt } from '@/lib/format'
import { cn } from '@/utilities/ui'

/** Wait this long after zero before asking the server for the new drop. */
const REFRESH_AFTER_MS = 5_000
/** If the page is still showing the old target, retry no sooner than this. */
const REFRESH_RETRY_MS = 15_000
/** Give up after this many refreshes for one target, so a stuck cache can never loop. */
const MAX_REFRESHES = 4

type Props = {
  /** ISO 8601 instant of the next drop, computed on the server (see getNextDropAt). */
  target: string
  className?: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Live countdown to the next drop.
 *
 * - The server passes `target` as an ISO string; it is rendered in <time dateTime>, so crawlers
 *   and no-JS visitors still get "Next drop <day>, 9:00 AM ET".
 * - The clock is read only inside the effect's timer callbacks (never during render), so the
 *   server render and the first client render are identical ("--"); the ticking digits carry
 *   suppressHydrationWarning anyway.
 * - Screen readers: the digits are not a live region (role="timer" is aria-live="off"), so ticks
 *   are never announced.
 * - After zero it calls router.refresh() (at most MAX_REFRESHES times per target) so the page
 *   picks up the new drop; a new `target` prop restarts the cycle.
 */
export function Countdown({ target, className }: Props) {
  const router = useRouter()
  const [nowMs, setNowMs] = useState<number | null>(null)
  const targetMs = Date.parse(target)

  // Keep the latest router without making it an effect dependency: the timer (and its refresh
  // budget) must only restart when the target changes, never because the router identity did.
  const routerRef = useRef(router)
  useEffect(() => {
    routerRef.current = router
  }, [router])

  useEffect(() => {
    let refreshes = 0
    let lastRefreshAt = 0

    const tick = () => {
      const now = Date.now()
      setNowMs(now)
      const sinceZero = now - targetMs
      if (
        sinceZero >= REFRESH_AFTER_MS &&
        refreshes < MAX_REFRESHES &&
        now - lastRefreshAt >= REFRESH_RETRY_MS
      ) {
        refreshes += 1
        lastRefreshAt = now
        routerRef.current.refresh()
      }
    }

    const first = setTimeout(tick, 0)
    const interval = setInterval(tick, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(interval)
    }
  }, [targetMs])

  const valid = !Number.isNaN(targetMs)
  const remaining =
    nowMs === null || !valid ? null : Math.max(0, Math.floor((targetMs - nowMs) / 1000))
  const live = remaining !== null && remaining === 0

  const hours = remaining === null ? '--' : pad(Math.floor(remaining / 3600))
  const minutes = remaining === null ? '--' : pad(Math.floor((remaining % 3600) / 60))
  const seconds = remaining === null ? '--' : pad(remaining % 60)

  const units: { value: string; short: string; long: string }[] = [
    { value: hours, short: 'HRS', long: 'HOURS' },
    { value: minutes, short: 'MIN', long: 'MINUTES' },
    { value: seconds, short: 'SEC', long: 'SECONDS' },
  ]

  return (
    <div className={cn('text-center md:text-left', className)}>
      <p className="mb-2.5 text-xs tracking-[0.18em] text-muted-foreground uppercase md:mb-3">
        {live ? 'Dropping now' : 'Next drop in'}
      </p>
      <div
        role="timer"
        aria-label="Time until the next drop"
        className="flex items-start justify-center gap-1 font-display md:justify-start md:gap-2"
      >
        {units.map((unit, i) => (
          <React.Fragment key={unit.short}>
            {i > 0 ? (
              <div
                aria-hidden="true"
                className="text-[44px] leading-[1.15] text-subtle-foreground md:text-[clamp(40px,5vw,64px)] md:leading-[1.1]"
              >
                :
              </div>
            ) : null}
            <div className="w-[88px] md:w-[116px]">
              <div
                suppressHydrationWarning
                className="text-[58px] leading-none font-medium [font-variant-numeric:lining-nums_tabular-nums] md:text-[clamp(48px,6vw,80px)]"
              >
                {unit.value}
              </div>
              <div className="mt-2 font-sans text-[11px] tracking-[0.16em] text-muted-foreground">
                <span className="md:hidden">{unit.short}</span>
                <span className="hidden md:inline">{unit.long}</span>
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
      {valid ? (
        <p className="mt-3.5 text-[13px] text-muted-foreground md:text-sm">
          Next drop <time dateTime={target}>{formatDropAt(target)}</time>. A new set of deals every
          day.
        </p>
      ) : null}
    </div>
  )
}
