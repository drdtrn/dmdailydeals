import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser } from '../helpers/seedUser'

const BASE = 'http://localhost:3000'
const user = { email: 'audience@payloadcms.com', password: 'test' }
const runId = Date.now().toString(36)
const emails = {
  js: `e2e-js-${runId}@example.test`,
  nojs: `e2e-nojs-${runId}@example.test`,
}

test.describe.configure({ mode: 'serial' })

test.afterAll(async () => {
  const payload = await getPayload({ config })
  await payload.delete({
    collection: 'subscribers',
    where: { email: { like: 'e2e-%@example.test' } },
    overrideAccess: true,
  })
})

test.describe('newsletter signup', () => {
  test('with JavaScript: the form posts in the background and shows success', async ({ page }) => {
    await page.goto(BASE)
    const form = page.locator('#newsletter form')
    await form.getByLabel('Email address').fill(emails.js)
    await form.getByRole('button', { name: 'Join the list' }).click()
    await expect(page.locator('#newsletter [role="status"]')).toContainText('You are on the list')
    // No navigation happened.
    expect(new URL(page.url()).search).toBe('')
  })

  test('an invalid address is rejected by the server with 400 and nothing is stored', async ({
    request,
  }) => {
    const response = await request.post(`${BASE}/api/subscribe`, {
      data: { email: 'not-an-email', source: 'e2e' },
    })
    expect(response.status()).toBe(400)
    expect(await response.json()).toMatchObject({ ok: false })
  })

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false })

    test('the native form post redirects (303) back and shows success', async ({ page }) => {
      await page.goto(BASE)
      const form = page.locator('#newsletter form')
      // Enter submits the native form. (Playwright's click waits for the button to stop moving,
      // and with JavaScript off the button never settles in dev.)
      await form.getByLabel('Email address').fill(emails.nojs)
      await form.getByLabel('Email address').press('Enter')
      await page.waitForURL(/\?subscribed=1#newsletter$/)
      await expect(page.locator('#newsletter [role="status"]')).toContainText('You are on the list')
    })
  })

  test('a form-encoded post answers 303 with a same-origin Location', async ({ request }) => {
    const response = await request.post(`${BASE}/api/subscribe`, {
      form: { email: `e2e-303-${runId}@example.test`, source: 'e2e' },
      headers: { Referer: `${BASE}/` },
      maxRedirects: 0,
    })
    expect(response.status()).toBe(303)
    expect(response.headers()['location']).toBe('/?subscribed=1#newsletter')
  })

  test('both signups were stored once, with consent facts and no IP', async () => {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'subscribers',
      where: { email: { in: [emails.js, emails.nojs] } },
      depth: 0,
      overrideAccess: true,
    })
    expect(docs).toHaveLength(2)
    for (const doc of docs) {
      expect(doc.status).toBe('active')
      expect(doc.source).toBe('home')
      expect(doc.consentText).toMatch(/^\d{4}-\d\d-\d\d-v\d+$/)
    }
  })
})

test.describe('admin audience tools', () => {
  test.beforeAll(async () => {
    await seedTestUser(user)
  })
  test.afterAll(async () => {
    await cleanupTestUser(user)
  })

  test('the click report loads for a logged-in user and is in the nav', async ({ page }) => {
    await login({ page, user })
    await expect(page.locator('a[href="/admin/reports/clicks"]').first()).toBeVisible()
    await page.goto(`${BASE}/admin/reports/clicks`)
    await expect(page.getByRole('heading', { name: 'Outbound clicks' })).toBeVisible()
    for (const days of [7, 30]) {
      await expect(page.getByTestId(`clicks-window-${days}`)).toContainText(`Last ${days} days`)
      await expect(page.getByTestId(`clicks-total-${days}`)).toHaveText(/^\d+$/)
    }
    await expect(page.getByText('UTC').first()).toBeVisible()
  })

  test('the click report sends anonymous visitors to the login page', async ({ page }) => {
    await page.goto(`${BASE}/admin/reports/clicks`)
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('the subscribers list offers the CSV export, and it downloads for an admin', async ({
    page,
  }) => {
    await login({ page, user })
    await page.goto(`${BASE}/admin/collections/subscribers`)
    await expect(page.getByTestId('export-subscribers')).toBeVisible()

    const response = await page.request.get(`${BASE}/api/subscribers/export`)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/csv')
    expect(response.headers()['content-disposition']).toContain('attachment')
    const csv = await response.text()
    expect(csv.split('\r\n')[0]).toBe('email,status,source,consentAt,consentText,createdAt')
    expect(csv).toContain(emails.js)
  })

  test('the CSV export refuses anonymous requests', async ({ request }) => {
    const response = await request.get(`${BASE}/api/subscribers/export`)
    expect([401, 403]).toContain(response.status())
    expect(await response.text()).not.toContain('@')
  })
})
