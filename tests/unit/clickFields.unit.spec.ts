import { describe, expect, it } from 'vitest'

import { countryFromHeader, sameOriginPath, utmFromSearchParams } from '@/lib/go/click'

const site = ['https://dmdailydeals.com', 'http://localhost:3000']

describe('sameOriginPath', () => {
  it('keeps only the path of a same-origin referer', () => {
    expect(sameOriginPath('https://dmdailydeals.com/deal/blue-widget?utm_source=x#top', site)).toBe(
      '/deal/blue-widget',
    )
    expect(sameOriginPath('http://localhost:3000/', site)).toBe('/')
    expect(sameOriginPath('https://dmdailydeals.com', site)).toBe('/')
  })

  it('drops cross-origin, malformed and missing referers', () => {
    expect(sameOriginPath('https://www.google.com/search?q=deals', site)).toBeUndefined()
    expect(sameOriginPath('https://dmdailydeals.com.evil.example/x', site)).toBeUndefined()
    expect(sameOriginPath('http://dmdailydeals.com/x', site)).toBeUndefined()
    expect(sameOriginPath('not a url', site)).toBeUndefined()
    expect(sameOriginPath('javascript:alert(1)', site)).toBeUndefined()
    expect(sameOriginPath(null, site)).toBeUndefined()
    expect(sameOriginPath('https://dmdailydeals.com/x', [null, undefined])).toBeUndefined()
  })

  it('caps the length', () => {
    const long = `https://dmdailydeals.com/${'a'.repeat(1000)}`
    expect(sameOriginPath(long, site)?.length).toBeLessThanOrEqual(300)
  })
})

describe('utmFromSearchParams', () => {
  it('reads the five utm values and ignores the rest', () => {
    const p = new URLSearchParams(
      'utm_source=newsletter&utm_medium=email&utm_campaign=nov&utm_content=hero&utm_term=tv&ref=x',
    )
    expect(utmFromSearchParams(p)).toEqual({
      source: 'newsletter',
      medium: 'email',
      campaign: 'nov',
      content: 'hero',
      term: 'tv',
    })
  })

  it('drops empty values and caps length', () => {
    const p = new URLSearchParams(`utm_source=&utm_medium=%20&utm_campaign=${'x'.repeat(500)}`)
    const utm = utmFromSearchParams(p)
    expect(utm.source).toBeUndefined()
    expect(utm.medium).toBeUndefined()
    expect(utm.campaign?.length).toBe(200)
  })
})

describe('countryFromHeader', () => {
  it('accepts two-letter codes, uppercased', () => {
    expect(countryFromHeader('us')).toBe('US')
    expect(countryFromHeader(' DE ')).toBe('DE')
  })
  it('rejects unknown and invalid values', () => {
    for (const v of ['XX', 'T1', '', null, undefined, 'USA', '1', 'U$'])
      expect(countryFromHeader(v)).toBeUndefined()
  })
})
