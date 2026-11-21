import { describe, expect, it } from 'vitest'

import { planDropTransition } from '@/lib/drops/plan'
import { collectDropTags, dropWarmPaths } from '@/lib/drops/tags'
import { buildIndexNowUrls, isLocalHost, resolveIndexNowTarget } from '@/lib/seo/indexnow'

const drop = (id: number, date: string, hour = 14) => ({
  id,
  date: `${date}T12:00:00.000Z`,
  publishAt: `${date}T${hour}:00:00.000Z`,
})

describe('planDropTransition', () => {
  it('does nothing when no drop is due', () => {
    expect(planDropTransition([], [drop(1, '2026-11-20')])).toEqual({
      publish: null,
      archiveIds: [],
    })
  })

  it('publishes the due drop and archives the live one', () => {
    const plan = planDropTransition([drop(2, '2026-11-21')], [drop(1, '2026-11-20')])
    expect(plan.publish?.id).toBe(2)
    expect(plan.archiveIds).toEqual([1])
  })

  it('lets the newest due drop win and archives the older due drops', () => {
    const plan = planDropTransition(
      [drop(2, '2026-11-19'), drop(4, '2026-11-21'), drop(3, '2026-11-20')],
      [drop(1, '2026-11-18')],
    )
    expect(plan.publish?.id).toBe(4)
    expect([...plan.archiveIds].sort()).toEqual([1, 2, 3])
  })

  it('archives every previously live drop', () => {
    const plan = planDropTransition(
      [drop(3, '2026-11-21')],
      [drop(1, '2026-11-19'), drop(2, '2026-11-20')],
    )
    expect(plan.publish?.id).toBe(3)
    expect([...plan.archiveIds].sort()).toEqual([1, 2])
  })

  it('never lets a back-filled older drop replace a newer live drop', () => {
    const plan = planDropTransition([drop(1, '2026-11-10')], [drop(2, '2026-11-21')])
    expect(plan.publish).toBeNull()
    expect(plan.archiveIds).toEqual([1])
  })
})

describe('collectDropTags', () => {
  it('collects the drop, hub and expired-deal tags once each', () => {
    const tags = collectDropTags({
      dropSlug: '2026-11-21',
      liveDeals: [
        { id: 1, categorySlug: 'tech', storeSlug: 'acme' },
        { id: 2, categorySlug: 'tech', storeSlug: 'globex' },
        { id: 3 },
      ],
      expiredDeals: [{ id: 9, slug: 'nine', categorySlug: 'home', storeSlug: 'acme' }],
    })
    expect(tags.sort()).toEqual(
      [
        'drop:current',
        'drop:2026-11-21',
        'drops',
        'sitemap',
        'category:tech',
        'category:home',
        'store:acme',
        'store:globex',
        'deal:9',
        'deal:nine',
        'deals',
      ].sort(),
    )
  })

  it('works without a new drop', () => {
    expect(collectDropTags({ expiredDeals: [{ id: 5 }] }).sort()).toEqual(
      ['deal:5', 'deals', 'drop:current', 'drops', 'sitemap'].sort(),
    )
    expect(dropWarmPaths()).toEqual(['/'])
    expect(dropWarmPaths('2026-11-21')).toEqual(['/', '/drops/2026-11-21'])
  })
})

describe('IndexNow helpers', () => {
  const key = 'abcdef1234567890'

  it('skips without a key, with an invalid key, and for local sites', () => {
    expect('skip' in resolveIndexNowTarget('https://dmdailydeals.com', undefined)).toBe(true)
    expect('skip' in resolveIndexNowTarget('https://dmdailydeals.com', '')).toBe(true)
    expect('skip' in resolveIndexNowTarget('https://dmdailydeals.com', 'short')).toBe(true)
    expect('skip' in resolveIndexNowTarget('http://localhost:3000', key)).toBe(true)
    expect('skip' in resolveIndexNowTarget('http://127.0.0.1:3000', key)).toBe(true)
    expect('skip' in resolveIndexNowTarget(undefined, key)).toBe(true)
    expect('skip' in resolveIndexNowTarget('nonsense', key)).toBe(true)
  })

  it('resolves host and key location for a public site', () => {
    expect(resolveIndexNowTarget('https://dmdailydeals.com', key)).toEqual({
      target: {
        host: 'dmdailydeals.com',
        origin: 'https://dmdailydeals.com',
        key,
        keyLocation: 'https://dmdailydeals.com/indexnow-key.txt',
      },
    })
  })

  it('recognises local hosts', () => {
    for (const h of ['localhost', 'app.localhost', '127.0.0.1', '0.0.0.0', '[::1]'])
      expect(isLocalHost(h)).toBe(true)
    expect(isLocalHost('dmdailydeals.com')).toBe(false)
  })

  it('builds the URL list', () => {
    expect(
      buildIndexNowUrls('https://dmdailydeals.com', '2026-11-21', ['a', 'b', 'a', null]),
    ).toEqual([
      'https://dmdailydeals.com/',
      'https://dmdailydeals.com/drops/2026-11-21',
      'https://dmdailydeals.com/drops',
      'https://dmdailydeals.com/deal/a',
      'https://dmdailydeals.com/deal/b',
    ])
  })
})
