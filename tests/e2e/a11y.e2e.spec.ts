import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Accessibility smoke test for the design system. /styleguide renders every component with
 * fixtures (it only exists outside production), so one axe pass covers the whole kit in both
 * colour schemes and at phone and desktop width. Fails on serious or critical violations.
 */
const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
]
const schemes = ['light', 'dark'] as const

for (const viewport of viewports) {
  for (const colorScheme of schemes) {
    test(`styleguide has no serious axe violations (${viewport.name}, ${colorScheme})`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme,
      })
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

test('styleguide is not indexable', async ({ page }) => {
  await page.goto('http://localhost:3000/styleguide')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})
