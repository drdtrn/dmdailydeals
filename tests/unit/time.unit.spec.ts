import { describe, expect, it } from 'vitest'

import {
  addDaysToYmd,
  computePublishAt,
  getNextDropAt,
  resolveDropSettings,
  todayInTimezone,
  ymdFromDateValue,
} from '@/lib/drops/time'

const settings = { dropTime: '09:00', timezone: 'America/New_York' }

describe('computePublishAt (09:00 America/New_York)', () => {
  it.each([
    ['2026-10-31', '2026-10-31T13:00:00.000Z'], // EDT (UTC-4)
    ['2026-11-01', '2026-11-01T14:00:00.000Z'], // DST ended at 02:00 that day: EST (UTC-5)
    ['2027-03-13', '2027-03-13T14:00:00.000Z'], // EST
    ['2027-03-14', '2027-03-14T13:00:00.000Z'], // DST started at 02:00 that day: EDT
    ['2026-07-04', '2026-07-04T13:00:00.000Z'],
    ['2026-12-25', '2026-12-25T14:00:00.000Z'],
  ])('%s -> %s', (ymd, iso) => {
    expect(computePublishAt(ymd, settings).toISOString()).toBe(iso)
  })

  it('respects a different time and zone', () => {
    expect(
      computePublishAt('2026-11-21', {
        dropTime: '15:30',
        timezone: 'Europe/Berlin',
      }).toISOString(),
    ).toBe('2026-11-21T14:30:00.000Z')
  })

  it('rejects malformed input', () => {
    expect(() => computePublishAt('2026-1-1', settings)).toThrow()
    expect(() => computePublishAt('2026-11-21', { ...settings, dropTime: '9am' })).toThrow()
  })
})

describe('date helpers', () => {
  it('reads the calendar day from stored values', () => {
    expect(ymdFromDateValue('2026-11-21T12:00:00.000Z')).toBe('2026-11-21')
    expect(ymdFromDateValue(new Date('2026-11-21T00:00:00.000Z'))).toBe('2026-11-21')
  })

  it('adds days across month and year ends', () => {
    expect(addDaysToYmd('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToYmd('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('finds today in a time zone', () => {
    const now = new Date('2026-11-21T03:00:00.000Z') // still the 20th in New York
    expect(todayInTimezone(now, 'America/New_York')).toBe('2026-11-20')
    expect(todayInTimezone(now, 'UTC')).toBe('2026-11-21')
  })
})

describe('getNextDropAt', () => {
  const s = resolveDropSettings(settings)

  it('returns today at drop time when it is still ahead', () => {
    const now = new Date('2026-10-31T12:59:00.000Z')
    expect(getNextDropAt(now, s).toISOString()).toBe('2026-10-31T13:00:00.000Z')
  })

  it('rolls to tomorrow once the drop has passed, strictly after now', () => {
    const now = new Date('2026-10-31T13:00:00.000Z')
    expect(getNextDropAt(now, s).toISOString()).toBe('2026-11-01T14:00:00.000Z')
  })

  it('crosses the spring DST change', () => {
    const now = new Date('2027-03-13T15:00:00.000Z')
    expect(getNextDropAt(now, s).toISOString()).toBe('2027-03-14T13:00:00.000Z')
  })

  it('prefers a valid future override and ignores a past one', () => {
    const now = new Date('2026-10-31T10:00:00.000Z')
    expect(
      getNextDropAt(now, { ...s, nextDropOverride: '2026-11-05T18:00:00.000Z' }).toISOString(),
    ).toBe('2026-11-05T18:00:00.000Z')
    expect(
      getNextDropAt(now, { ...s, nextDropOverride: '2026-10-01T18:00:00.000Z' }).toISOString(),
    ).toBe('2026-10-31T13:00:00.000Z')
  })
})

describe('resolveDropSettings', () => {
  it('falls back to defaults for missing or invalid values', () => {
    expect(resolveDropSettings(null)).toMatchObject({
      dropTime: '09:00',
      timezone: 'America/New_York',
    })
    expect(resolveDropSettings({ dropTime: 'noon', timezone: 'Mars/Base' })).toMatchObject({
      dropTime: '09:00',
      timezone: 'America/New_York',
    })
  })
})
