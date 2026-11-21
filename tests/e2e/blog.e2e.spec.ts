import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * The blog, read with JavaScript switched off. Needs the seed (`pnpm seed`): the example guide and
 * its example author are the seed's fixtures.
 */
test.use({ javaScriptEnabled: false })

const BASE = 'http://localhost:3000'
const SLUG = 'example-guide-how-to-pick-a-carry-on'
const TITLE = 'EXAMPLE GUIDE: how to pick a carry-on'
const AUTHOR = 'EXAMPLE AUTHOR (dev data, not a real person)'

type Json = Record<string, any>

const jsonLd = (html: string): Json[] =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1]),
  )

test.describe('blog (no JavaScript)', () => {
  test('/blog lists the guide with its category, date and author', async ({ page }) => {
    const res = await page.goto(`${BASE}/blog`)
    expect(res?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveText('Blog')
    const card = page.locator('article', { hasText: TITLE })
    await expect(card).toBeVisible()
    await expect(card).toContainText('Travel')
    await expect(card).toContainText(`By ${AUTHOR}`)
    await expect(card.locator('time[datetime]')).toBeVisible()
    await expect(card.getByRole('link', { name: TITLE })).toHaveAttribute('href', `/blog/${SLUG}`)
  })

  test('the guide renders byline, content, sources, related deals, newsletter and BlogPosting markup', async ({
    page,
    request,
  }) => {
    const res = await page.goto(`${BASE}/blog/${SLUG}`)
    expect(res?.status()).toBe(200)

    await expect(page.locator('h1')).toHaveText(TITLE)
    // Byline: name, published date, breadcrumb trail
    await expect(page.getByText(`By ${AUTHOR}`).first()).toBeVisible()
    await expect(page.getByText('Published', { exact: false }).first()).toBeVisible()
    const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(crumbs).toContainText('DMDailyDeals')
    await expect(crumbs.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog')

    // Content converted from Lexical: heading, list, internal and external links
    await expect(
      page.getByRole('heading', { name: 'Check the size limit first', level: 2 }),
    ).toBeVisible()
    await expect(page.locator('main li', { hasText: 'Wheel quality' })).toBeVisible()
    await expect(page.locator('main').getByRole('link', { name: 'travel deals' })).toHaveAttribute(
      'href',
      '/deals/travel',
    )

    // Author box with bio and profile links
    const authorBox = page.getByRole('complementary', { name: 'About the author' })
    await expect(authorBox).toContainText(AUTHOR)
    await expect(authorBox).toContainText('EXAMPLE COPY')
    await expect(authorBox.getByRole('link', { name: 'example.com' })).toHaveAttribute(
      'href',
      'https://example.com/example-author',
    )

    // Sources
    const sources = page.getByRole('region', { name: 'Sources' })
    await expect(sources.getByRole('link', { name: /Example source/ })).toHaveAttribute(
      'href',
      'https://example.com/source',
    )

    // Related deals, with the affiliate disclosure above them
    const deals = page.getByRole('heading', { name: 'Related deals', level: 2 })
    await expect(deals).toBeVisible()
    await expect(
      page.locator('main').getByText('Paid links: we may earn a commission'),
    ).toBeVisible()
    await expect(
      page.getByRole('list', { name: 'Related deals' }).getByRole('listitem'),
    ).toHaveCount(2)
    const order = await page.evaluate(() => {
      const disclosure = [...document.querySelectorAll('p')].find((p) =>
        p.textContent?.includes('Paid links: we may earn'),
      )
      const list = document.querySelector('ul[aria-label="Related deals"]')
      return disclosure && list
        ? Boolean(disclosure.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING)
        : false
    })
    expect(order).toBe(true)

    // Newsletter CTA for the blog source
    await expect(
      page.locator('form[action="/api/subscribe"] input[name="source"][value="blog"]'),
    ).toHaveCount(1)

    // Structured data: BlogPosting + BreadcrumbList, no AI properties
    const html = await (await request.get(`${BASE}/blog/${SLUG}`)).text()
    const blocks = jsonLd(html)
    const post = blocks.find((b) => b['@type'] === 'BlogPosting')!
    expect(post).toBeTruthy()
    expect(post.headline).toBe(TITLE)
    expect(post.author).toEqual({
      '@type': 'Person',
      name: AUTHOR,
      sameAs: ['https://example.com/example-author'],
    })
    expect(post.publisher['@type']).toBe('Organization')
    expect(post.datePublished).toMatch(/^\d{4}-\d\d-\d\dT/)
    expect(new Date(post.dateModified).getTime()).toBeGreaterThanOrEqual(
      new Date(post.datePublished).getTime(),
    )
    expect(post.image[0]).toMatch(/^https?:\/\//)
    expect(post.articleSection).toBe('Travel')
    expect(post.url).toBe(`${BASE}/blog/${SLUG}`)
    const crumbsLd = blocks.find((b) => b['@type'] === 'BreadcrumbList')!
    expect(crumbsLd.itemListElement.map((i: Json) => i.name)).toEqual([
      'DMDailyDeals',
      'Blog',
      TITLE,
    ])
    expect(blocks.some((b) => b['@type'] === 'FAQPage')).toBe(false)

    // Nothing internal leaks into the page
    for (const secret of [
      'aiAssisted',
      'reviewedBy',
      'reviewedAt',
      'blog-briefs',
      'example-author@seed',
    ]) {
      expect(html).not.toContain(secret)
    }
    expect(html).not.toMatch(
      /\bAI[- ](?:generated|assisted|written)\b|written by AI|machine[- ]generated/i,
    )
    // Canonical and an indexable page
    expect(html).toContain(`<link rel="canonical" href="${BASE}/blog/${SLUG}"`)
  })

  test('the home page shows "From the blog"', async ({ page }) => {
    await page.goto(`${BASE}/`)
    const heading = page.getByRole('heading', { name: 'From the blog', level: 2 })
    await expect(heading).toBeVisible()
    await expect(
      page
        .getByRole('list', { name: 'Latest guides' })
        .getByRole('link', { name: new RegExp(TITLE) }),
    ).toHaveAttribute('href', `/blog/${SLUG}`)
    await expect(page.getByRole('link', { name: 'All guides' })).toHaveAttribute('href', '/blog')
  })

  test('the Travel hub shows "Latest guides", the other hubs do not', async ({ page }) => {
    await page.goto(`${BASE}/deals/travel`)
    await expect(page.getByRole('heading', { name: 'Latest guides', level: 2 })).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(TITLE) })).toHaveAttribute(
      'href',
      `/blog/${SLUG}`,
    )
    await page.goto(`${BASE}/deals/tech`)
    await expect(page.getByRole('heading', { name: 'Latest guides' })).toHaveCount(0)
  })

  test('crawler surfaces list the guide', async ({ request }) => {
    expect(await (await request.get(`${BASE}/llms.txt`)).text()).toContain(`${BASE}/blog/${SLUG}`)
    const sitemap = await (await request.get(`${BASE}/sitemap/posts.xml`)).text()
    expect(sitemap).toContain(`${BASE}/blog/${SLUG}`)
  })

  test('the public API never exposes the internal fields', async ({ request }) => {
    const res = await request.get(`${BASE}/api/posts?limit=100&depth=2`)
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain(SLUG)
    for (const secret of ['aiAssisted', 'reviewedBy', 'reviewedAt', 'example-author@seed']) {
      expect(body).not.toContain(secret)
    }
    const doc = JSON.parse(body).docs.find((d: Json) => d.slug === SLUG)
    expect(Object.keys(doc.populatedAuthor).sort()).toEqual([
      'avatar',
      'bio',
      'displayName',
      'id',
      'sameAs',
    ])
    expect((await request.get(`${BASE}/api/blog-briefs`)).status()).toBe(403)
    expect((await request.get(`${BASE}/api/users`)).status()).toBe(403)
    const settings = await (await request.get(`${BASE}/api/globals/site-settings`)).text()
    expect(settings).not.toContain('monthlyDraftCap')
  })

  test('an unknown guide is a 404', async ({ request }) => {
    expect((await request.get(`${BASE}/blog/does-not-exist`)).status()).toBe(404)
  })
})

// axe needs JavaScript to run in the page; the guide itself is server-rendered either way.
test.describe('blog accessibility', () => {
  test.use({ javaScriptEnabled: true })

  for (const [name, viewport, scheme] of [
    ['phone, light', { width: 390, height: 844 }, 'light'],
    ['desktop, dark', { width: 1440, height: 900 }, 'dark'],
  ] as const) {
    test(`the guide has no serious axe violations (${name})`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto(`${BASE}/blog/${SLUG}`)
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
          nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
        })),
      ).toEqual([])
    })
  }
})
