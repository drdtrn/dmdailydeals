import { describe, expect, it } from 'vitest'

import { applyLinkTemplate, buildOutboundUrl, parseHttpUrl } from '@/lib/go/outboundUrl'

const product = 'https://www.example-shop.com/p/widget?color=red&size=m'
const active = (linkTemplate: string) => ({ affiliateStatus: 'active', linkTemplate })

describe('applyLinkTemplate', () => {
  it('substitutes {url} raw and {encodedUrl} percent-encoded', () => {
    expect(applyLinkTemplate('{url}', product)).toBe(product)
    expect(applyLinkTemplate('https://t.example.net/d?u={encodedUrl}', product)).toBe(
      `https://t.example.net/d?u=${encodeURIComponent(product)}`,
    )
  })

  it('replaces every occurrence and never interprets $ patterns in the product URL', () => {
    const odd = 'https://shop.example.com/p?x=$&y=$1'
    expect(applyLinkTemplate('{url}|{url}', odd)).toBe(`${odd}|${odd}`)
  })
})

describe('buildOutboundUrl per affiliate program (realistic templates)', () => {
  const cases: [string, string, string][] = [
    ['none', '{url}', product],
    ['direct', '{url}', product],
    [
      'ebay',
      'https://rover.ebay.com/rover/1/711-53200-19255-0/1?mpre={encodedUrl}&campid=5338000000&toolid=10001',
      `https://rover.ebay.com/rover/1/711-53200-19255-0/1?mpre=${encodeURIComponent(product)}&campid=5338000000&toolid=10001`,
    ],
    [
      'aliexpress',
      'https://s.click.aliexpress.com/deep_link.htm?dl_target_url={encodedUrl}&aff_short_key=UneMJZVf',
      `https://s.click.aliexpress.com/deep_link.htm?dl_target_url=${encodeURIComponent(product)}&aff_short_key=UneMJZVf`,
    ],
    [
      'amazon',
      'https://www.amazon.com/dp/B000TEST?tag=dmdaily-20',
      'https://www.amazon.com/dp/B000TEST?tag=dmdaily-20',
    ],
    [
      'skimlinks',
      'https://go.skimresources.com/?id=123X456&xs=1&url={encodedUrl}',
      `https://go.skimresources.com/?id=123X456&xs=1&url=${encodeURIComponent(product)}`,
    ],
    [
      'sovrn',
      'https://redirect.viglink.com/?key=abc123&u={encodedUrl}',
      `https://redirect.viglink.com/?key=abc123&u=${encodeURIComponent(product)}`,
    ],
    [
      'awin',
      'https://www.awin1.com/cread.php?awinmid=1234&awinaffid=5678&ued={encodedUrl}',
      `https://www.awin1.com/cread.php?awinmid=1234&awinaffid=5678&ued=${encodeURIComponent(product)}`,
    ],
    [
      'impact',
      'https://example.pxf.io/c/1234567/987654/1234?u={encodedUrl}',
      `https://example.pxf.io/c/1234567/987654/1234?u=${encodeURIComponent(product)}`,
    ],
    [
      'cj',
      'https://www.anrdoezrs.net/links/1234567/type/dlg/sid/dmdd/{url}',
      `https://www.anrdoezrs.net/links/1234567/type/dlg/sid/dmdd/${product}`,
    ],
  ]

  it.each(cases)('%s', (_program, template, expected) => {
    expect(buildOutboundUrl(product, active(template))).toBe(new URL(expected).href)
  })

  it('appends an affiliate tag to the raw URL', () => {
    expect(buildOutboundUrl('https://shop.example.com/p/1', active('{url}&tag=dmdd-20'))).toBe(
      'https://shop.example.com/p/1&tag=dmdd-20',
    )
  })

  it.each(['none', 'pending', undefined, null])(
    'uses the plain product URL when affiliateStatus is %s',
    (affiliateStatus) => {
      expect(
        buildOutboundUrl(product, {
          affiliateStatus,
          linkTemplate: 'https://t.example.net/d?u={encodedUrl}',
        }),
      ).toBe(product)
    },
  )
})

describe('rejection of unsafe URLs', () => {
  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>1</script>',
    'ftp://files.example.com/x',
    '/relative/path',
    '//evil.example.com/x',
    'not a url',
    '',
    '   ',
    null,
    undefined,
    42,
  ])('parseHttpUrl(%j) is null', (value) => {
    expect(parseHttpUrl(value)).toBeNull()
  })

  it('rejects an unsafe product URL, even for an inactive store', () => {
    expect(buildOutboundUrl('javascript:alert(1)', { affiliateStatus: 'none' })).toBeNull()
    expect(buildOutboundUrl('javascript:alert(1)', active('{url}'))).toBeNull()
  })

  it('rejects a template that produces a non-http(s) or relative result', () => {
    expect(buildOutboundUrl(product, active('javascript:void({encodedUrl})'))).toBeNull()
    expect(buildOutboundUrl(product, active('/relative?u={encodedUrl}'))).toBeNull()
    expect(buildOutboundUrl(product, active('{encodedUrl}'))).toBeNull()
    expect(buildOutboundUrl(product, active(''))).toBeNull()
    expect(buildOutboundUrl(product, { affiliateStatus: 'active', linkTemplate: null })).toBeNull()
  })

  it('normalises the result', () => {
    expect(parseHttpUrl('  HTTPS://Shop.Example.com/a b  ')).toBe('https://shop.example.com/a%20b')
  })
})
