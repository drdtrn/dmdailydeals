import { describe, expect, it } from 'vitest'

import { parseDropDate } from '@/lib/drops/time'

describe('parseDropDate', () => {
  it('accepts real calendar dates', () => {
    expect(parseDropDate('2026-11-21')).toBe('2026-11-21')
    expect(parseDropDate('2028-02-29')).toBe('2028-02-29')
  })
  it.each([
    '2026-02-30',
    '2027-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-1-5',
    '26-11-21',
    '2026-11-21T00:00',
    '',
    'latest',
    '2026-11-21/',
  ])('rejects %j', (value) => {
    expect(parseDropDate(value)).toBeNull()
  })
  it('rejects non-strings', () => {
    expect(parseDropDate(undefined)).toBeNull()
    expect(parseDropDate(null)).toBeNull()
  })
})
