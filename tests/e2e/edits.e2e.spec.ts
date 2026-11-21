import { expect, test, type APIRequestContext } from '@playwright/test'

import { cleanupTestUser, seedTestUser } from '../helpers/seedUser'

/**
 * Editing content in the admin must show on the public page on the very next request, with no
 * manual cache clear. This drives the real stack: REST writes as an admin run the collection hooks,
 * which call `revalidateTag`, and the public pages read through `unstable_cache`.
 *
 * Uses deals nothing else asserts on, and restores everything it changes.
 */
test.describe.configure({ mode: 'serial' })

const BASE = 'http://localhost:3000'
const DEAL_SLUG = 'compact-binoculars-10x25'

const editor = { email: 'edits-e2e@example.com', password: 'test' }

let token = ''

async function api(
  request: APIRequestContext,
  method: 'get' | 'patch' | 'post' | 'delete',
  path: string,
  data?: unknown,
) {
  const response = await request[method](`${BASE}/api${path}`, {
    headers: { Authorization: `JWT ${token}` },
    ...(data === undefined ? {} : { data }),
  })
  expect(response.ok(), `${method.toUpperCase()} ${path} -> ${response.status()}`).toBeTruthy()
  return response.json()
}

async function page(request: APIRequestContext, path: string) {
  const response = await request.get(`${BASE}${path}`)
  expect(response.status(), path).toBe(200)
  return response.text()
}

test.beforeAll(async ({ request }) => {
  await seedTestUser(editor)
  const login = await request.post(`${BASE}/api/users/login`, { data: editor })
  expect(login.ok()).toBeTruthy()
  token = (await login.json()).token
})

test.afterAll(async () => {
  await cleanupTestUser(editor)
})

test('editing a published deal’s title and price shows on /deal/<slug> on the next request', async ({
  request,
}) => {
  const found = await api(request, 'get', `/deals?where[slug][equals]=${DEAL_SLUG}&limit=1`)
  const deal = found.docs[0]
  expect(deal, 'seeded deal').toBeTruthy()

  // Warm the cache, so the test proves invalidation rather than a first read.
  const before = await page(request, `/deal/${DEAL_SLUG}`)
  expect(before).toContain(deal.title)

  const editedTitle = `${deal.title} (edited ${Date.now()})`
  try {
    // generateSlug:false keeps the URL stable; slug changes are covered by the hook's old+new tags.
    await api(request, 'patch', `/deals/${deal.id}`, {
      title: editedTitle,
      price: 31,
      generateSlug: false,
    })
    const after = await page(request, `/deal/${DEAL_SLUG}`)
    expect(after).toContain(editedTitle)
    expect(after).toContain('$31')
  } finally {
    await api(request, 'patch', `/deals/${deal.id}`, {
      title: deal.title,
      price: deal.price,
      generateSlug: false,
    })
  }
  const restored = await page(request, `/deal/${DEAL_SLUG}`)
  expect(restored).not.toContain(editedTitle)
})

test('editing a category intro shows on /deals/<slug> on the next request', async ({ request }) => {
  const found = await api(request, 'get', '/categories?where[slug][equals]=home&limit=1')
  const category = found.docs[0]
  expect(category, 'seeded category').toBeTruthy()

  expect(await page(request, '/deals/home')).toContain(category.intro.slice(0, 40))

  const edited = `Edited intro ${Date.now()}: kitchen and comfort picks.`
  try {
    await api(request, 'patch', `/categories/${category.id}`, { intro: edited })
    expect(await page(request, '/deals/home')).toContain(edited)
  } finally {
    await api(request, 'patch', `/categories/${category.id}`, { intro: category.intro })
  }
  expect(await page(request, '/deals/home')).not.toContain(edited)
})

test('a store with no published deals has no hub page', async ({ request }) => {
  const slug = `empty-store-${Date.now()}`
  const store = await api(request, 'post', '/stores', {
    name: slug,
    slug,
    domain: 'empty.example.com',
  })
  try {
    const response = await request.get(`${BASE}/stores/${slug}`)
    expect(response.status()).toBe(404)
  } finally {
    await api(request, 'delete', `/stores/${store.doc.id}`)
  }
})
