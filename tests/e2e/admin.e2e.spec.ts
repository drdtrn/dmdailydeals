import { test, expect, Page } from '@playwright/test'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

test.describe('Admin Panel', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()

    const context = await browser.newContext()
    page = await context.newPage()

    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('can navigate to dashboard', async () => {
    await page.goto('http://localhost:3000/admin')
    await expect(page).toHaveURL('http://localhost:3000/admin')
    const dashboardArtifact = page.locator('span[title="Dashboard"]').first()
    await expect(dashboardArtifact).toBeVisible()
  })

  test('can navigate to list view', async () => {
    await page.goto('http://localhost:3000/admin/collections/users')
    await expect(page).toHaveURL('http://localhost:3000/admin/collections/users')
    const listViewArtifact = page.locator('h1', { hasText: 'Users' }).first()
    await expect(listViewArtifact).toBeVisible()
  })

  test('can navigate to edit view', async () => {
    await page.goto('http://localhost:3000/admin/collections/pages/create')
    await expect(page).toHaveURL(/\/admin\/collections\/pages\/[a-zA-Z0-9-_]+/)
    const editViewArtifact = page.locator('input[name="title"]')
    await expect(editViewArtifact).toBeVisible()
  })

  test('lists the content collections in the nav and hides clicks', async () => {
    await page.goto('http://localhost:3000/admin')
    for (const slug of ['deals', 'drops', 'stores', 'events', 'subscribers', 'price-snapshots']) {
      await expect(page.locator(`a[href="/admin/collections/${slug}"]`).first()).toBeVisible()
    }
    await expect(page.locator('a[href="/admin/collections/clicks"]')).toHaveCount(0)
  })

  test('can open the deal list and the drop edit form', async () => {
    // Not /deals/create: drafts-enabled collections create a draft row as soon as that page opens.
    await page.goto('http://localhost:3000/admin/collections/deals')
    await expect(page.locator('h1', { hasText: 'Deals' }).first()).toBeVisible()
    await page.goto('http://localhost:3000/admin/collections/drops/create')
    await expect(page.locator('#field-picks')).toBeVisible()
  })
})
