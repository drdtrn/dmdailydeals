import { describe, expect, it } from 'vitest'

import {
  hasEvergreenIntro,
  isEventInSeason,
  isEventIndexable,
  isThinStore,
} from '@/lib/seo/indexing'

describe('thin store hubs', () => {
  it.each([
    [0, true],
    [1, true],
    [2, true],
    [3, false],
    [10, false],
  ])('%i published deals: thin = %s', (count, thin) => {
    expect(isThinStore(count)).toBe(thin)
  })
})

describe('event hubs', () => {
  const window = { startsAt: '2026-11-20T14:00:00.000Z', endsAt: '2026-12-01T04:59:00.000Z' }
  const evergreen = 'x'.repeat(140)

  it('is in season from three weeks before the start until the end', () => {
    expect(isEventInSeason(window, new Date('2026-10-31T00:00:00Z'))).toBe(true)
    expect(isEventInSeason(window, new Date('2026-10-01T00:00:00Z'))).toBe(false)
    expect(isEventInSeason(window, new Date('2026-11-25T00:00:00Z'))).toBe(true)
    expect(isEventInSeason(window, new Date('2026-12-02T00:00:00Z'))).toBe(false)
  })

  it('an event with no dates is never in season', () => {
    expect(isEventInSeason({}, new Date())).toBe(false)
  })

  it('outside its window with no evergreen intro: not indexable', () => {
    const now = new Date('2027-03-01T00:00:00Z')
    expect(isEventIndexable(window, now)).toBe(false)
    expect(isEventIndexable({ ...window, intro: 'short blurb' }, now)).toBe(false)
  })

  it('outside its window with an evergreen intro: indexable', () => {
    expect(
      isEventIndexable({ ...window, intro: evergreen }, new Date('2027-03-01T00:00:00Z')),
    ).toBe(true)
    expect(hasEvergreenIntro({ intro: `  ${evergreen}  ` })).toBe(true)
    expect(hasEvergreenIntro({ intro: null })).toBe(false)
  })

  it('in season: indexable even without an intro', () => {
    expect(isEventIndexable(window, new Date('2026-11-21T00:00:00Z'))).toBe(true)
  })
})
