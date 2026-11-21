import { describe, expect, it } from 'vitest'

import { isPageInRange, pageWindow, parsePageParam, totalPagesFor } from '@/lib/pagination'

describe('parsePageParam', () => {
  it('defaults to page 1', () => {
    expect(parsePageParam(undefined)).toEqual({ ok: true, page: 1 })
  })
  it('reads plain positive integers', () => {
    expect(parsePageParam('1')).toEqual({ ok: true, page: 1 })
    expect(parsePageParam('12')).toEqual({ ok: true, page: 12 })
    expect(parsePageParam(['3', '4'])).toEqual({ ok: true, page: 3 })
  })
  it.each(['0', '-1', '2.5', 'abc', '', '01', '1e3', ' 2', '9999999'])('rejects %j', (value) => {
    expect(parsePageParam(value)).toEqual({ ok: false })
  })
})

describe('totalPagesFor / isPageInRange', () => {
  it('rounds up and never goes below one page', () => {
    expect(totalPagesFor(0, 12)).toBe(1)
    expect(totalPagesFor(12, 12)).toBe(1)
    expect(totalPagesFor(13, 12)).toBe(2)
    expect(totalPagesFor(25, 12)).toBe(3)
  })
  it('flags out-of-range pages', () => {
    expect(isPageInRange(1, 0, 12)).toBe(true)
    expect(isPageInRange(2, 0, 12)).toBe(false)
    expect(isPageInRange(2, 13, 12)).toBe(true)
    expect(isPageInRange(3, 13, 12)).toBe(false)
    expect(isPageInRange(0, 13, 12)).toBe(false)
  })
})

describe('pageWindow', () => {
  it('shows everything for a few pages', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3])
  })
  it('collapses gaps', () => {
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10])
    expect(pageWindow(1, 10)).toEqual([1, 2, null, 10])
    expect(pageWindow(10, 10)).toEqual([1, null, 9, 10])
  })
  it('does not insert a gap for a single hidden page', () => {
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5])
  })
})
