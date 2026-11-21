/**
 * "Lowest in 90 days": the single source of truth for the badge on cards, the hero and deal pages.
 * Pure: no Payload, no clock (the caller passes `now`), so it is cheap to unit test.
 *
 * The claim is only made when the price history can support it:
 * 1. the snapshot history reaches back at least `minCoverageDays` (30) into the window, so a deal
 *    that was first seen last week cannot claim a 90-day low, and
 * 2. the current price is at or below the lowest price in effect during the last `windowDays` (90).
 *
 * A snapshot records the price from its `capturedAt` until the next snapshot. So the price that was
 * in effect when the window opened is the newest snapshot from *before* the window; it counts toward
 * the minimum even though it was captured earlier.
 */

export type PriceSnapshotPoint = {
  price: number
  capturedAt: string | Date
}

export const LOWEST_WINDOW_DAYS = 90
export const LOWEST_MIN_COVERAGE_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

export function isLowestInWindow({
  currentPrice,
  snapshots,
  now,
  windowDays = LOWEST_WINDOW_DAYS,
  minCoverageDays = LOWEST_MIN_COVERAGE_DAYS,
}: {
  currentPrice: number
  snapshots: readonly PriceSnapshotPoint[]
  now: Date
  windowDays?: number
  minCoverageDays?: number
}): boolean {
  if (!Number.isFinite(currentPrice)) return false
  const nowMs = now.getTime()
  const windowStart = nowMs - windowDays * DAY_MS

  const points = snapshots
    .map((s) => ({ price: s.price, at: new Date(s.capturedAt).getTime() }))
    // Ignore malformed rows and anything captured in the future.
    .filter((s) => Number.isFinite(s.price) && Number.isFinite(s.at) && s.at <= nowMs)
    .sort((a, b) => a.at - b.at)
  if (points.length === 0) return false

  // Coverage: how far back does the history reach, measured inside the window?
  const earliest = Math.max(points[0].at, windowStart)
  if (nowMs - earliest < minCoverageDays * DAY_MS) return false

  let minimum = Infinity
  let carryIn: number | null = null
  for (const point of points) {
    if (point.at < windowStart)
      carryIn = point.price // newest pre-window snapshot wins (sorted)
    else minimum = Math.min(minimum, point.price)
  }
  if (carryIn !== null) minimum = Math.min(minimum, carryIn)

  return currentPrice <= minimum
}
