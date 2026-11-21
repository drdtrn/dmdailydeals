import { test, expect } from '@playwright/test'

test.describe('Frontend', () => {
  test('can load homepage', async ({ page }) => {
    await page.goto('http://localhost:3000')
    await expect(page).toHaveTitle(/DMDailyDeals/)
    // Today's hero deal is the h1 (or, before the first drop, the "First drop lands" heading).
    const heading = page.locator('h1')
    await expect(heading).toHaveCount(1)
    await expect(heading).toHaveText(/\S/)
    await expect(heading).not.toHaveText('DMDailyDeals')
  })

  test('the countdown ticks and the header links work', async ({ page }) => {
    await page.goto('http://localhost:3000')
    await expect(page.getByRole('timer').first()).not.toContainText('--')
    await page
      .locator('header')
      .getByRole('link', { name: 'Tech', exact: true })
      .filter({ visible: true })
      .first()
      .click()
    await expect(page).toHaveURL(/\/deals\/tech$/)
    await expect(page.locator('h1')).toHaveText('Tech deals')
  })
})
