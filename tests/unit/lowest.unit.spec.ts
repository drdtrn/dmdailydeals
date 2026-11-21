import { describe, expect, it } from 'vitest'

import { isLowestInWindow } from '@/lib/deals/lowest'

const now = new Date('2026-11-21T15:00:00.000Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()

describe('isLowestInWindow', () => {
  it('is true when 30+ days of history exist and the price is the lowest', () => {
    expect(
      isLowestInWindow({
        currentPrice: 100,
        now,
        snapshots: [
          { price: 150, capturedAt: daysAgo(60) },
          { price: 130, capturedAt: daysAgo(20) },
          { price: 100, capturedAt: daysAgo(1) },
        ],
      }),
    ).toBe(true)
  })

  it('is true when the price ties the minimum', () => {
    expect(
      isLowestInWindow({
        currentPrice: 100,
        now,
        snapshots: [
          { price: 100, capturedAt: daysAgo(45) },
          { price: 120, capturedAt: daysAgo(10) },
        ],
      }),
    ).toBe(true)
  })

  it('is false when the price was lower earlier in the window', () => {
    expect(
      isLowestInWindow({
        currentPrice: 100,
        now,
        snapshots: [
          { price: 90, capturedAt: daysAgo(50) },
          { price: 130, capturedAt: daysAgo(20) },
        ],
      }),
    ).toBe(false)
  })

  it('is false with no history', () => {
    expect(isLowestInWindow({ currentPrice: 100, now, snapshots: [] })).toBe(false)
  })

  it('is false when the history covers fewer than 30 days', () => {
    expect(
      isLowestInWindow({
        currentPrice: 100,
        now,
        snapshots: [
          { price: 150, capturedAt: daysAgo(29) },
          { price: 100, capturedAt: daysAgo(1) },
        ],
      }),
    ).toBe(false)
  })

  it('accepts history that reaches back exactly 30 days', () => {
    expect(
      isLowestInWindow({
        currentPrice: 100,
        now,
        snapshots: [{ price: 120, capturedAt: daysAgo(30) }],
      }),
    ).toBe(true)
  })

  it('counts the price in effect when the window opened (carry-in from before the window)', () => {
    // 80 was captured 120 days ago and never changed until 40 days ago: it was in effect on day 90.
    expect(
      isLowestInWindow({
        currentPrice: 100,
        now,
        snapshots: [
          { price: 80, capturedAt: daysAgo(120) },
          { price: 130, capturedAt: daysAgo(40) },
        ],
      }),
    ).toBe(false)
  })

  it('ignores a low price that was replaced before the window opened', () => {
    expect(
      isLowestInWindow({
        currentPrice: 100,
        now,
        snapshots: [
          { price: 50, capturedAt: daysAgo(200) },
          { price: 140, capturedAt: daysAgo(100) },
          { price: 120, capturedAt: daysAgo(30) },
        ],
      }),
    ).toBe(true)
  })

  it('ignores future and malformed snapshots', () => {
    expect(
      isLowestInWindow({
        currentPrice: 100,
        now,
        snapshots: [
          { price: 120, capturedAt: daysAgo(40) },
          { price: 10, capturedAt: new Date(now.getTime() + 86_400_000).toISOString() },
          { price: Number.NaN, capturedAt: daysAgo(5) },
          { price: 10, capturedAt: 'not a date' },
        ],
      }),
    ).toBe(true)
  })

  it('is false for a price above the minimum, and for a non-finite price', () => {
    const snapshots = [{ price: 90, capturedAt: daysAgo(40) }]
    expect(isLowestInWindow({ currentPrice: 91, now, snapshots })).toBe(false)
    expect(isLowestInWindow({ currentPrice: Number.NaN, now, snapshots })).toBe(false)
  })

  it('honours custom window and coverage', () => {
    const snapshots = [{ price: 100, capturedAt: daysAgo(10) }]
    expect(isLowestInWindow({ currentPrice: 100, now, snapshots, minCoverageDays: 7 })).toBe(true)
    expect(isLowestInWindow({ currentPrice: 100, now, snapshots, minCoverageDays: 14 })).toBe(false)
  })
})
