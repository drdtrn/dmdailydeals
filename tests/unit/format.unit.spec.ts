import { describe, expect, it } from 'vitest'

import {
  formatDateTimeET,
  formatDropAt,
  formatDropTime,
  formatPercentOff,
  formatPrice,
  percentOff,
} from '@/lib/format'

describe('formatPrice', () => {
  it('drops cents on whole amounts and keeps them otherwise', () => {
    expect(formatPrice(229)).toBe('$229')
    expect(formatPrice(22.5)).toBe('$22.50')
    expect(formatPrice(1299)).toBe('$1,299')
  })
})

describe('percentOff', () => {
  it('rounds to a whole percentage', () => {
    expect(percentOff(229, 369)).toBe(38)
    expect(percentOff(199, 289)).toBe(31)
  })
  it('is null without a real discount', () => {
    expect(percentOff(100, undefined)).toBeNull()
    expect(percentOff(100, null)).toBeNull()
    expect(percentOff(100, 100)).toBeNull()
    expect(percentOff(100, 90)).toBeNull()
    expect(percentOff(99.9, 100)).toBeNull() // under 1%
  })
  it('formats with a real minus sign', () => {
    expect(formatPercentOff(38)).toBe('−38%')
  })
})

describe('drop time formatting (always Eastern, always "ET")', () => {
  it('reads 9:00 AM ET in both winter and summer', () => {
    expect(formatDropTime('2026-11-22T14:00:00.000Z')).toBe('9:00 AM ET') // EST
    expect(formatDropTime('2026-07-04T13:00:00.000Z')).toBe('9:00 AM ET') // EDT
  })
  it('formats absolute dates', () => {
    expect(formatDropAt('2026-11-22T14:00:00.000Z')).toBe('Sun, Nov 22, 9:00 AM ET')
    expect(formatDateTimeET('2026-11-21T14:14:00.000Z')).toBe('Nov 21, 9:14 AM ET')
  })
  it('returns an empty string for invalid input', () => {
    expect(formatDropTime('nope')).toBe('')
    expect(formatDateTimeET('nope')).toBe('')
  })
})
