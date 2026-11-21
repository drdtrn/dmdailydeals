import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Accessibility smoke test for the design system. /styleguide renders every component with
 * fixtures (it only exists outside production), so one axe pass covers the whole kit in both
 * colour themes (light by default, dark as an explicit opt-in) and at phone and desktop width. Fails on serious or critical violations.
 */
const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
]
// Light is the default for everyone, even when the OS prefers dark; dark is an explicit opt-in
// through the dm-theme cookie that the footer ThemeToggle writes.
const schemes = [
  { name: 'light', colorScheme: 'light', theme: undefined },
  { name: 'light with OS dark', colorScheme: 'dark', theme: undefined },
  { name: 'dark opt-in', colorScheme: 'light', theme: 'dark' },
] as const

async function themedContext(
  browser: import('@playwright/test').Browser,
  viewport: { width: number; height: number },
  scheme: (typeof schemes)[number],
) {
  const context = await browser.newContext({ viewport, colorScheme: scheme.colorScheme })
  if (scheme.theme) {
    await context.addCookies([
      { name: 'dm-theme', value: scheme.theme, url: 'http://localhost:3000' },
    ])
  }
  return context
}

for (const viewport of viewports) {
  for (const colorScheme of schemes) {
    test(`styleguide has no serious axe violations (${viewport.name}, ${colorScheme.name})`, async ({
      browser,
    }) => {
      const context = await themedContext(browser, viewport, colorScheme)
      const page = await context.newPage()
      await page.goto('http://localhost:3000/styleguide', { waitUntil: 'networkidle' })
      await expect(page.locator('h1')).toHaveText('Style guide')
      // Let the countdown take its first tick so the digits are real, not "--".
      await expect(page.getByRole('timer').first()).not.toContainText('--')

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .exclude('nextjs-portal') // the Next.js dev overlay, not our markup
        .analyze()

      const blocking = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      )
      expect(
        blocking.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
        })),
      ).toEqual([])

      await context.close()
    })
  }
}

/**
 * The real pages, on the seeded data: the home page and a live deal page, at both sizes and in
 * both colour schemes.
 */
const realPages = [
  { name: 'home', path: '/' },
  { name: 'deal', path: '/deal/over-ear-wireless-noise-cancelling-headphones' },
]

for (const { name, path } of realPages) {
  for (const viewport of viewports) {
    for (const colorScheme of schemes) {
      test(`${name} page has no serious axe violations (${viewport.name}, ${colorScheme.name})`, async ({
        browser,
      }) => {
        const context = await themedContext(browser, viewport, colorScheme)
        const page = await context.newPage()
        await page.goto(`http://localhost:3000${path}`, { waitUntil: 'networkidle' })
        await expect(page.locator('h1')).toHaveCount(1)

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
          .exclude('nextjs-portal')
          .analyze()

        const blocking = results.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        )
        expect(
          blocking.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
          })),
        ).toEqual([])

        await context.close()
      })
    }
  }
}

test('styleguide is not indexable', async ({ page }) => {
  await page.goto('http://localhost:3000/styleguide')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})

// Computed colours come back as rgb() or lab() depending on the browser; reduce both to a 0-100 lightness.
function lightness(color: string): number {
  const lab = /^lab\(([\d.]+)/.exec(color)
  if (lab) return Number(lab[1])
  const [r, g, b] = (color.match(/[\d.]+/g) ?? []).map(Number)
  return ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) * 100
}

test('the site is light by default, ignores an OS dark preference, and dark is opt-in', async ({
  browser,
}) => {
  const read = async (scheme: (typeof schemes)[number]) => {
    const context = await themedContext(browser, { width: 1440, height: 900 }, scheme)
    const page = await context.newPage()
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
    const state = await page.evaluate(() => ({
      dataTheme: document.documentElement.getAttribute('data-theme'),
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      background: getComputedStyle(document.body).backgroundColor,
      header: getComputedStyle(document.querySelector('header')!).backgroundColor,
    }))
    await context.close()
    return state
  }

  const osDark = await read(schemes[1])
  expect(osDark.dataTheme).toBeNull()
  expect(osDark.colorScheme).toBe('light')
  expect(lightness(osDark.background)).toBeGreaterThan(90) // porcelain

  const optIn = await read(schemes[2])
  expect(optIn.dataTheme).toBe('dark')
  expect(optIn.colorScheme).toBe('dark')
  expect(lightness(optIn.background)).toBeLessThan(30)
})
