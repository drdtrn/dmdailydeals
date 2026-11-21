import { describe, expect, it } from 'vitest'

import { getUmamiConfig, UmamiScript } from '../../src/components/analytics/Umami'

const SRC = 'https://stats.example.com/script.js'

describe('getUmamiConfig', () => {
  it('is null unless both the script URL and the website id are set', () => {
    expect(getUmamiConfig({})).toBeNull()
    expect(getUmamiConfig({ NEXT_PUBLIC_UMAMI_SRC: SRC })).toBeNull()
    expect(getUmamiConfig({ NEXT_PUBLIC_UMAMI_WEBSITE_ID: 'abc' })).toBeNull()
    expect(
      getUmamiConfig({
        NEXT_PUBLIC_UMAMI_SRC: 'javascript:alert(1)',
        NEXT_PUBLIC_UMAMI_WEBSITE_ID: 'abc',
      }),
    ).toBeNull()
  })

  it('restricts data-domains to the production host, and not for a local site', () => {
    const base = { NEXT_PUBLIC_UMAMI_SRC: SRC, NEXT_PUBLIC_UMAMI_WEBSITE_ID: 'abc' }
    expect(getUmamiConfig({ ...base, NEXT_PUBLIC_SERVER_URL: 'https://dmdailydeals.com' })).toEqual(
      {
        src: SRC,
        websiteId: 'abc',
        domains: 'dmdailydeals.com',
      },
    )
    expect(getUmamiConfig({ ...base, NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000' })).toEqual({
      src: SRC,
      websiteId: 'abc',
    })
    expect(
      getUmamiConfig({
        ...base,
        NEXT_PUBLIC_SERVER_URL: 'https://dmdailydeals.com',
        NEXT_PUBLIC_UMAMI_DOMAINS: 'dmdailydeals.com,www.dmdailydeals.com',
      })?.domains,
    ).toBe('dmdailydeals.com,www.dmdailydeals.com')
  })
})

describe('UmamiScript', () => {
  it('renders nothing without configuration', () => {
    expect(UmamiScript({ config: null })).toBeNull()
  })

  it('renders an afterInteractive script with the website id and domains when configured', () => {
    const element = UmamiScript({
      config: { src: SRC, websiteId: 'site-1', domains: 'dmdailydeals.com' },
    }) as { props: Record<string, string> } | null
    expect(element).not.toBeNull()
    expect(element!.props).toMatchObject({
      src: SRC,
      strategy: 'afterInteractive',
      'data-website-id': 'site-1',
      'data-domains': 'dmdailydeals.com',
    })
  })

  it('reads the environment by default: absent when unset', () => {
    // The test environment sets no NEXT_PUBLIC_UMAMI_* variables.
    expect(UmamiScript({})).toBeNull()
  })
})
