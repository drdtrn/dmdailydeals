import { describe, expect, it } from 'vitest'

import {
  buildCaption,
  buildPicksMessage,
  CAPTION_LIMIT,
  DISCLOSURE_LINE,
  escapeHtml,
  MESSAGE_LIMIT,
  truncate,
  type TelegramDeal,
} from '../../src/lib/telegram/format'

const ORIGIN = 'https://dmdailydeals.com'
const deal = (over: Partial<TelegramDeal> = {}): TelegramDeal => ({
  title: 'Noise-cancelling headphones',
  slug: 'noise-cancelling-headphones',
  price: 199,
  wasPrice: 299.99,
  currency: 'USD',
  ...over,
})
const len = (s: string) => Array.from(s).length

describe('escapeHtml / truncate', () => {
  it('escapes the HTML special characters', () => {
    expect(escapeHtml(`<b>"Tom & Jerry"</b>`)).toBe(
      '&lt;b&gt;&quot;Tom &amp; Jerry&quot;&lt;/b&gt;',
    )
  })
  it('truncates by code point with an ellipsis and collapses whitespace', () => {
    expect(truncate('short', 10)).toBe('short')
    expect(truncate('abcdefghij', 5)).toBe('abcd…')
    expect(truncate('😀😀😀😀', 3)).toBe('😀😀…')
    expect(truncate('a\n\n b', 10)).toBe('a b')
  })
})

describe('buildCaption', () => {
  it('has the drop date, hero title, price and was-price', () => {
    const caption = buildCaption({ dropDateIso: '2026-11-21T12:00:00.000Z', hero: deal() })
    expect(caption).toContain('Saturday, November 21, 2026')
    expect(caption).toContain('Noise-cancelling headphones')
    expect(caption).toContain('<b>$199</b>')
    expect(caption).toContain('was $299.99')
  })

  it('escapes HTML in titles', () => {
    const caption = buildCaption({
      dropDateIso: '2026-11-21T12:00:00.000Z',
      hero: deal({ title: 'A <b>bold</b> & "risky" title' }),
    })
    expect(caption).toContain('A &lt;b&gt;bold&lt;/b&gt; &amp; &quot;risky&quot; title')
    expect(caption).not.toContain('<b>bold</b>')
  })

  it('omits the was-price when there is no real discount', () => {
    const caption = buildCaption({
      dropDateIso: '2026-11-21T12:00:00.000Z',
      hero: deal({ wasPrice: null }),
    })
    expect(caption).not.toContain('was')
  })

  it('never exceeds 1024 characters, even with a huge title of escape-heavy characters', () => {
    const caption = buildCaption({
      dropDateIso: '2026-11-21T12:00:00.000Z',
      hero: deal({ title: '<&>'.repeat(2000) }),
    })
    expect(len(caption)).toBeLessThanOrEqual(CAPTION_LIMIT)
    // Truncation never leaves a half-cut entity behind.
    expect(caption).not.toMatch(/&[a-z]*$/m)
  })
})

describe('buildPicksMessage', () => {
  const picks = Array.from({ length: 6 }, (_, i) =>
    deal({
      title: `Pick ${i + 1} & co`,
      slug: `pick-${i + 1}`,
      price: 10 * (i + 1),
      wasPrice: null,
    }),
  )

  it('lists each pick with its deal link and price, ending with the disclosure', () => {
    const text = buildPicksMessage({ picks, origin: ORIGIN })
    expect(text).toContain(`<a href="${ORIGIN}/deal/pick-1">Pick 1 &amp; co</a> · $10`)
    expect(text).toContain(`<a href="${ORIGIN}/deal/pick-6">Pick 6 &amp; co</a> · $60`)
    expect(text).toContain(DISCLOSURE_LINE)
    expect(text.trimEnd().endsWith(`<a href="${ORIGIN}/disclosure">Affiliate disclosure</a>`)).toBe(
      true,
    )
    // No affiliate links: only our own pages.
    expect(text).not.toContain('/go/')
  })

  it('stays within 4096 characters and keeps the disclosure when there are too many picks', () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      deal({ title: 'T'.repeat(200), slug: `p-${i}`, wasPrice: null }),
    )
    const text = buildPicksMessage({ picks: many, origin: ORIGIN })
    expect(len(text)).toBeLessThanOrEqual(MESSAGE_LIMIT)
    expect(text).toContain(DISCLOSURE_LINE)
    // Whole lines only: every opened link is closed.
    expect((text.match(/<a /g) ?? []).length).toBe((text.match(/<\/a>/g) ?? []).length)
  })
})
