import { expect, test } from '@playwright/test'

import { todayInTimezone } from '../../src/lib/drops/time'

/**
 * Every public route type must put its primary content in the server-rendered HTML. JavaScript is
 * switched off for the whole file, so anything that only appears after hydration fails here.
 *
 * Needs the seed (`pnpm seed`): the titles and slugs below are the seed's fixtures.
 */
test.use({ javaScriptEnabled: false })

const BASE = 'http://localhost:3000'
const TODAY = todayInTimezone(new Date(), 'America/New_York')

const HERO = {
  title: 'Over-Ear Wireless Noise-Cancelling Headphones',
  slug: 'over-ear-wireless-noise-cancelling-headphones',
}
const EXPIRED = {
  title: 'Robot Vacuum with Self-Emptying Base',
  slug: 'robot-vacuum-with-self-emptying-base',
}

async function open(page: import('@playwright/test').Page, path: string) {
  const response = await page.goto(`${BASE}${path}`)
  expect(response?.status(), `${path} status`).toBe(200)
}

test.describe('server-rendered pages (no JavaScript)', () => {
  test('home: hero deal is the h1, with countdown, picks, eSIM slot and newsletter', async ({
    page,
  }) => {
    await open(page, '/')
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('h1')).toContainText(HERO.title)
    // The countdown renders its target as readable text without JavaScript.
    await expect(page.locator('time[datetime]').first()).toBeVisible()
    await expect(page.getByText('Next drop', { exact: false }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Today’s picks' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Browse by category' })).toContainText('All')
    await expect(page.getByText('Paid links').first()).toBeVisible()
    await expect(page.getByText('The deal that never expires').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Get the drop by email' })).toBeVisible()
    // 1 hero + 7 picks, each with a tracked link.
    expect(await page.locator('a[href^="/go/"]').count()).toBeGreaterThanOrEqual(8)
  })

  test('drops archive lists drops with date, title and pick count', async ({ page }) => {
    await open(page, '/drops')
    await expect(page.locator('h1')).toHaveText('Deal drop archive')
    const first = page.locator('ul[aria-label="Drops, newest first"] > li').first()
    await expect(first.locator('time')).toHaveAttribute('datetime', TODAY)
    await expect(first).toContainText(HERO.title)
    await expect(first).toContainText(/\d+ deals/)
  })

  test('a drop page shows the date in the heading, hero, picks and neighbours', async ({
    page,
  }) => {
    await open(page, `/drops/${TODAY}`)
    await expect(page.locator('h1')).toContainText('Deals of')
    await expect(page.getByRole('heading', { name: HERO.title })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'The picks' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Other drops' })).toContainText(
      'Previous drop',
    )
  })

  test('a category hub shows its intro, live deals and recent drops', async ({ page }) => {
    await open(page, '/deals/tech')
    await expect(page.locator('h1')).toHaveText('Tech deals')
    await expect(page.getByText('Headphones, chargers, storage', { exact: false })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible()
    await expect(page.locator('a[href^="/go/"]').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: /Recent drops with tech deals/ })).toBeVisible()
  })

  test('a live deal page has price, why it’s a deal, a sponsored CTA and the lowest badge', async ({
    page,
  }) => {
    await open(page, `/deal/${HERO.slug}`)
    await expect(page.locator('h1')).toHaveText(HERO.title)
    await expect(page.getByText('$119').first()).toBeVisible()
    await expect(page.locator('s').first()).toContainText('$199')
    await expect(page.getByRole('heading', { name: 'Why it’s a deal' })).toBeVisible()
    await expect(page.getByText('Price checked').first()).toBeVisible()
    await expect(page.getByText('Lowest in 90 days').first()).toBeVisible()
    const cta = page.locator(`a[href^="/go/"][rel="sponsored nofollow"]`).first()
    await expect(cta).toBeVisible()
    await expect(page.getByText('Paid links').first()).toBeVisible()
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0)
  })

  test('the lowest badge needs real history: no badge with a lower earlier price or short history', async ({
    page,
  }) => {
    // Seed: a lower price 60 days ago.
    await open(page, '/deal/programmable-slow-cooker-6-quart')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.getByText('Lowest in 90 days')).toHaveCount(0)
    // Seed: only 10 days of history.
    await open(page, '/deal/cordless-stick-vacuum-with-wall-dock')
    await expect(page.getByText('Lowest in 90 days')).toHaveCount(0)
  })

  test('an expired deal page says so, has no buy CTA and links to live alternatives', async ({
    page,
  }) => {
    await open(page, `/deal/${EXPIRED.slug}`)
    await expect(page.locator('h1')).toHaveText(EXPIRED.title)
    await expect(page.getByTestId('unavailable-note')).toContainText('This deal has ended')
    // No buy CTA on the expired deal itself (the live alternatives below have their own).
    await expect(page.locator('article[data-state="expired"] a[href^="/go/"]')).toHaveCount(0)
    await expect(page.locator('article[data-state="expired"]').first()).toBeVisible()
    await expect(page.getByText('Lowest in 90 days')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /Live home deals instead/ })).toBeVisible()
    // Still indexable.
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0)
    // The alternatives are live deals.
    expect(await page.locator('a[href^="/deal/"]').count()).toBeGreaterThan(0)
  })

  test('a store hub lists its live deals', async ({ page }) => {
    await open(page, '/stores/example-electronics')
    await expect(page.locator('h1')).toHaveText('Example Electronics deals')
    await expect(page.locator('a[href^="/go/"]').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Recently ended' })).toBeVisible()
  })

  test('a CMS page renders its title and content', async ({ page }) => {
    await open(page, '/disclosure')
    await expect(page.locator('h1')).toHaveText('Disclosure')
    await expect(page.getByText('REPLACE THIS PLACEHOLDER', { exact: false }).first()).toBeVisible()
  })

  test('an event hub shows its window and deals', async ({ page }) => {
    await open(page, '/black-friday')
    await expect(page.locator('h1')).toHaveText('Black Friday deals')
    await expect(page.getByText('Event ·', { exact: false })).toBeVisible()
    await expect(page.locator('a[href^="/go/"]').first()).toBeVisible()
  })

  test('/esim renders the offer with a sponsored link and disclosure', async ({ page }) => {
    await open(page, '/esim')
    await expect(page.locator('h1')).toHaveText('Travel eSIM data plans')
    await expect(page.getByText('Example eSIM Partner').first()).toBeVisible()
    await expect(page.getByText('EXAMPLE10').first()).toBeVisible()
    const cta = page.locator('a[rel~="sponsored"]').first()
    await expect(cta).toHaveAttribute('href', /^https:\/\/esim\.example\.com/)
    await expect(cta).toHaveAttribute('rel', /nofollow/)
    await expect(page.getByText('Paid links').first()).toBeVisible()
  })

  test('the blog index renders', async ({ page }) => {
    await open(page, '/blog')
    await expect(page.locator('h1')).toHaveText('Blog')
  })
})

const NOT_FOUND_PATHS = [
  '/deal/x',
  '/drops/2020-01-01',
  '/drops/not-a-date',
  '/drops?page=99',
  '/drops?page=abc',
  '/deals/nope',
  '/stores/nope',
  '/nope',
  '/blog/nope',
  '/blog/page/99',
]

test.describe('real 404s and redirects', () => {
  for (const path of NOT_FOUND_PATHS) {
    test(`${path} returns status 404`, async ({ page }) => {
      const response = await page.goto(`${BASE}${path}`)
      expect(response?.status()).toBe(404)
      expect(await response?.text()).toContain('noindex')
    })
  }

  test('the template’s /posts URLs redirect permanently to /blog', async ({ request }) => {
    for (const [from, to] of [
      ['/posts', '/blog'],
      ['/posts/some-post', '/blog/some-post'],
      ['/posts/page/2', '/blog/page/2'],
    ]) {
      const response = await request.get(`${BASE}${from}`, { maxRedirects: 0 })
      expect(response.status()).toBe(308)
      expect(new URL(response.headers()['location'], BASE).pathname).toBe(to)
    }
  })
})

// Next renders a 404 as an error shell and paints the not-found UI from the streamed payload, so the
// styled page needs JavaScript (the status code and noindex do not).
test.describe('the styled 404 page', () => {
  test.use({ javaScriptEnabled: true })

  test('shows the designed not-found page inside the site layout', async ({ page }) => {
    await page.goto(`${BASE}/deal/x`)
    await expect(page.locator('h1')).toHaveText('This page isn’t here')
    await expect(page.getByRole('link', { name: 'Today’s drop' })).toBeVisible()
    await expect(page.getByRole('contentinfo')).toBeVisible()
  })
})
