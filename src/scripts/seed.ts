/**
 * Development and test fixture data.
 *
 *   pnpm seed            (payload run src/scripts/seed.ts)
 *
 * Everything here is clearly example data (example.com URLs, "Example" stores, placeholder images,
 * "REPLACE" legal copy). It must never land in production as real offers, so the script refuses to
 * run when NODE_ENV=production unless forced (`--force`, or `SEED_FORCE=1`).
 *
 * It is safe to run repeatedly: records are matched by name/title/slug and left alone if they
 * already exist. Run it on a freshly migrated database with `PAYLOAD_DB_PUSH=false pnpm seed`, or
 * on the dev database (push mode) with plain `pnpm seed`.
 */
import fs from 'fs'
import sharp from 'sharp'

import type { CollectionSlug, Payload, Where } from 'payload'

import { buildProductKey } from '../lib/deals/productKey'
import { getDropSettings } from '../lib/drops/settings'
import { addDaysToYmd, computePublishAt, todayInTimezone } from '../lib/drops/time'

/**
 * `payload run` rebuilds process.argv from positional arguments only, which drops `--flags`. So
 * besides `force` / SEED_FORCE, look at the process's original command line (Linux).
 */
function isForced(): boolean {
  if (process.env.SEED_FORCE === '1' || process.env.SEED_FORCE === 'true') return true
  if (process.argv.includes('--force') || process.argv.includes('force')) return true
  try {
    return fs.readFileSync('/proc/self/cmdline', 'utf8').split('\0').includes('--force')
  } catch {
    return false
  }
}

if (process.env.NODE_ENV === 'production' && !isForced()) {
  console.error(
    'Refusing to seed: NODE_ENV=production. This script inserts fake example offers.\n' +
      'If you really mean it (e.g. a throwaway production-mode test database), pass --force.',
  )
  process.exit(1)
}

const context = { disableRevalidate: true }

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const log = (msg: string) => console.log(`[seed] ${msg}`)

// ---------------------------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------------------------

type CategoryKey = 'Home' | 'Tech' | 'Travel'

const CATEGORIES: { title: CategoryKey; intro: string; color: string }[] = [
  {
    title: 'Home',
    color: '#2f6f5e',
    intro:
      'EXAMPLE COPY. Replace with original text. Kitchen, cleaning, comfort and small upgrades that make a house easier to live in, picked only when the discount is real.',
  },
  {
    title: 'Tech',
    color: '#27406b',
    intro:
      'EXAMPLE COPY. Replace with original text. Headphones, chargers, storage and everyday gadgets, with the price history checked before we call something a deal.',
  },
  {
    title: 'Travel',
    color: '#7a4a1f',
    intro:
      'EXAMPLE COPY. Replace with original text. Luggage, adapters and trip gear that earns its space in a bag, plus the occasional stay or ticket worth booking.',
  },
]

const STORES = [
  { name: 'Example Electronics', domain: 'electronics.example.com' },
  { name: 'Example Home Supply', domain: 'homesupply.example.com' },
  { name: 'Example Outfitters', domain: 'outfitters.example.com' },
  { name: 'Example Travel Co', domain: 'travel.example.com' },
  { name: 'Example Marketplace', domain: 'marketplace.example.com' },
  { name: 'Example Gadget Depot', domain: 'gadgets.example.com' },
] as const

type DealSeed = {
  title: string
  store: (typeof STORES)[number]['name']
  category: CategoryKey
  price: number
  wasPrice: number
  note: string
  coupon?: string
}

const DEALS: DealSeed[] = [
  // --- today's drop: hero + picks (indexes 0..7) ---
  {
    title: 'Over-Ear Wireless Noise-Cancelling Headphones',
    store: 'Example Electronics',
    category: 'Tech',
    price: 119,
    wasPrice: 199,
    note: 'Example data. The best price we tracked on this model in the last quarter and the first time it dips under 120 dollars. Battery life is the real selling point: roughly 40 hours with noise cancelling on, which covers a long-haul flight and the trip back.',
  },
  {
    title: '65W GaN Dual-Port Wall Charger',
    store: 'Example Gadget Depot',
    category: 'Tech',
    price: 27,
    wasPrice: 45,
    coupon: 'EXAMPLE5',
    note: 'Example data. One small brick charges a laptop and a phone at once, which replaces two bulky chargers in a travel bag. The discount matches the lowest price it has had this year, so there is no reason to wait for a bigger sale.',
  },
  {
    title: '2TB Portable SSD, USB-C',
    store: 'Example Electronics',
    category: 'Tech',
    price: 109,
    wasPrice: 159,
    note: 'Example data. Fast enough to edit video straight from the drive and small enough to forget in a jacket pocket. Storage prices move slowly, so a drop of about thirty percent below the usual price is worth acting on rather than watching.',
  },
  {
    title: 'Programmable Slow Cooker, 6 Quart',
    store: 'Example Home Supply',
    category: 'Home',
    price: 39,
    wasPrice: 69,
    note: 'Example data. A plain, sturdy slow cooker with a removable stoneware pot that goes in the dishwasher. We like that the lid seals well and the timer switches to warm on its own, so dinner is ready when you get home rather than overcooked.',
  },
  {
    title: 'Cordless Stick Vacuum with Wall Dock',
    store: 'Example Home Supply',
    category: 'Home',
    price: 179,
    wasPrice: 299,
    note: 'Example data. Strong suction for hard floors and rugs, with a battery that realistically lasts a full small apartment. The wall dock keeps it charged and out of the way. This is its lowest tracked price, ahead of the usual holiday promotions.',
  },
  {
    title: 'Memory Foam Pillow, Set of Two',
    store: 'Example Marketplace',
    category: 'Home',
    price: 34,
    wasPrice: 60,
    note: 'Example data. A medium-firm pillow that holds its shape instead of going flat after a month, which is the usual complaint with cheap sets. The covers are washable, and the two-pack makes the per-pillow price very low.',
  },
  {
    title: 'Hard-Shell Carry-On Spinner Suitcase',
    store: 'Example Travel Co',
    category: 'Travel',
    price: 89,
    wasPrice: 150,
    note: 'Example data. Fits the carry-on limits of the big US airlines, has quiet double spinner wheels and a hard shell that survives overhead bins. The price is the lowest it has been, and it has never needed a coupon to get there.',
  },
  {
    title: 'Universal Travel Adapter with 4 USB Ports',
    store: 'Example Travel Co',
    category: 'Travel',
    price: 19,
    wasPrice: 32,
    note: 'Example data. One adapter covers the US, UK, EU and Australia plugs, and the four USB ports charge a phone, watch and earbuds from a single socket. Cheap enough to buy a spare so you never leave one behind in a hotel room.',
  },
  // --- yesterday's drop: hero + picks (indexes 8..14), already expired ---
  {
    title: 'Robot Vacuum with Self-Emptying Base',
    store: 'Example Home Supply',
    category: 'Home',
    price: 229,
    wasPrice: 399,
    note: 'Example data. Self-emptying bases used to cost twice this much. The mapping is reliable, and the base holds around two months of dust, so the chore all but disappears. An expired example: yesterday only.',
  },
  {
    title: 'True Wireless Earbuds with Charging Case',
    store: 'Example Electronics',
    category: 'Tech',
    price: 49,
    wasPrice: 89,
    note: 'Example data. Solid sound for the price, a comfortable fit for long sessions and a case that gives about four extra charges. Good as a backup pair, and the price is near the bottom of its range. An expired example from yesterday.',
  },
  {
    title: '10,000 mAh Slim Power Bank',
    store: 'Example Gadget Depot',
    category: 'Tech',
    price: 21,
    wasPrice: 35,
    note: 'Example data. Thin enough to slip in a back pocket and enough capacity for roughly two full phone charges. It supports fast charging both ways, which most pocket-sized banks skip. An expired example from yesterday.',
  },
  {
    title: 'Cast Iron Dutch Oven, 5.5 Quart',
    store: 'Example Home Supply',
    category: 'Home',
    price: 59,
    wasPrice: 110,
    note: 'Example data. Enameled cast iron that goes from stovetop to oven and keeps heat evenly for braises and bread. Heavy, but a pot like this lasts decades, and this is half the price of the famous brands. An expired example from yesterday.',
  },
  {
    title: 'Packing Cubes, Set of Six',
    store: 'Example Travel Co',
    category: 'Travel',
    price: 17,
    wasPrice: 30,
    note: 'Example data. Six sizes in a lightweight mesh that lets you see inside and compresses a week of clothes into half the space. Zippers are the weak point on cheap sets; these have held up in our test pack. An expired example.',
  },
  {
    title: 'Neck Travel Pillow with Memory Foam',
    store: 'Example Travel Co',
    category: 'Travel',
    price: 15,
    wasPrice: 28,
    note: 'Example data. Supports the sides of your neck rather than just the back, which is what stops your head dropping on a flight. It clips to a bag strap so it does not take up carry space. An expired example from yesterday.',
  },
  {
    title: 'Insulated Water Bottle, 32 oz',
    store: 'Example Outfitters',
    category: 'Travel',
    price: 22,
    wasPrice: 38,
    note: 'Example data. Keeps water cold for a full day and coffee hot for several hours, with a lid that does not leak in a bag. Dents show but do not affect performance. A typical price for this size is higher; this is an expired example.',
  },
  // --- extra deals not in a drop (indexes 15..19) ---
  {
    title: 'Mechanical Keyboard, Hot-Swappable',
    store: 'Example Electronics',
    category: 'Tech',
    price: 64,
    wasPrice: 99,
    note: 'Example data. A compact board where you can swap switches without soldering, which makes it worth the money for people who want to tune the feel. Build quality is solid and the price is a new low.',
  },
  {
    title: 'Air Purifier for Rooms up to 400 sq ft',
    store: 'Example Home Supply',
    category: 'Home',
    price: 79,
    wasPrice: 130,
    note: 'Example data. A true HEPA filter and a quiet low setting that is fine for a bedroom. Replacement filters are reasonably priced, which matters more than the sticker price over two years. A good price for this size.',
  },
  {
    title: 'Smart LED Bulbs, 4-Pack',
    store: 'Example Marketplace',
    category: 'Home',
    price: 24,
    wasPrice: 40,
    note: 'Example data. Work with the major voice assistants without a separate hub and hold their schedules when the wifi drops. Four bulbs at this price brings each one under six dollars, the lowest we have recorded.',
  },
  {
    title: 'Lightweight Daypack, 22L',
    store: 'Example Outfitters',
    category: 'Travel',
    price: 29,
    wasPrice: 50,
    note: 'Example data. Packs down to the size of a fist for the trip and opens up for day hikes or museum days. Straps are padded where it matters and the fabric is water resistant, not waterproof, so pack accordingly.',
  },
  {
    title: 'Compact Binoculars, 10x25',
    store: 'Example Outfitters',
    category: 'Travel',
    price: 36,
    wasPrice: 65,
    note: 'Example data. Small enough for a coat pocket and clear enough for birding, stadiums and viewpoints. The focus wheel is smooth and the case is included. Price is the lowest in the last six months of tracking.',
  },
]

const TODAY_HERO = 0
const TODAY_PICKS = [1, 2, 3, 4, 5, 6, 7]
const YESTERDAY_HERO = 8
const YESTERDAY_PICKS = [9, 10, 11, 12, 13, 14]

/**
 * Back-dated price history, so "Lowest in 90 days" shows up in development and the e2e tests.
 * `daysAgo` is relative to the day the seed runs. The deals' current prices (see DEALS) decide the
 * outcome:
 * - indexes 0, 1, 2: history reaches back 30+ days and the current price is the lowest -> badge
 * - index 3: a lower price 60 days ago -> no badge
 * - index 4: only 10 days of history (less than the 30 needed) -> no badge
 * Everything else has just the snapshot written when the deal was published -> no badge.
 */
const PRICE_HISTORY: Record<number, { daysAgo: number; price: number }[]> = {
  0: [
    { daysAgo: 75, price: 199 },
    { daysAgo: 50, price: 169 },
    { daysAgo: 25, price: 149 },
  ],
  1: [
    { daysAgo: 45, price: 45 },
    { daysAgo: 15, price: 39 },
  ],
  2: [{ daysAgo: 100, price: 159 }],
  3: [
    { daysAgo: 60, price: 29 },
    { daysAgo: 30, price: 49 },
  ],
  4: [{ daysAgo: 10, price: 299 }],
}

/** Deals shown on the Black Friday event hub (indexes into DEALS). */
const EVENT_DEALS = [0, 3, 15, 16, 17, 18, 19]

const LEGAL_PAGES = [
  {
    title: 'About',
    body: [
      'REPLACE THIS PLACEHOLDER. Write who runs DMDailyDeals, how deals are picked and how prices are checked.',
      'This text is a stub created by the seed script. It is not final copy.',
    ],
  },
  {
    title: 'Disclosure',
    body: [
      'REPLACE THIS PLACEHOLDER. Explain, in plain words, how the site earns money from links and which links are affiliate links.',
      'This text is a stub created by the seed script. It is not final copy.',
    ],
  },
  {
    title: 'Privacy',
    body: [
      'REPLACE THIS PLACEHOLDER. Describe what data is collected (analytics, click logging, newsletter email) and how long it is kept.',
      'This text is a stub created by the seed script. It is not final copy.',
    ],
  },
  {
    title: 'Terms',
    body: [
      'REPLACE THIS PLACEHOLDER. Write the terms of use, including that prices and availability can change at the store.',
      'This text is a stub created by the seed script. It is not final copy.',
    ],
  },
]

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

function lexical(paragraphs: string[]) {
  return {
    root: {
      type: 'root',
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        version: 1,
        textFormat: 0,
        textStyle: '',
        children: [
          { type: 'text', text, detail: 0, format: 0, mode: 'normal', style: '', version: 1 },
        ],
      })),
    },
  }
}

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Greedy word wrap into at most `maxLines` lines of about `maxChars` characters. */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const word of text.split(/\s+/)) {
    if ((current + ' ' + word).trim().length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = (current + ' ' + word).trim()
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, maxLines)
}

/** A placeholder product image (1200x900 PNG) rendered from SVG with sharp. No downloads. */
async function placeholderImage(title: string, store: string, color: string): Promise<Buffer> {
  const lines = wrap(title, 22, 3)
  const text = lines
    .map(
      (line, i) =>
        `<text x="600" y="${400 + i * 78}" font-size="64" font-weight="700" text-anchor="middle" fill="#ffffff" font-family="sans-serif">${escapeXml(line)}</text>`,
    )
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <rect width="1200" height="900" fill="${color}"/>
  <rect x="40" y="40" width="1120" height="820" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="4"/>
  <text x="600" y="150" font-size="34" text-anchor="middle" fill="#ffffff" fill-opacity="0.85" font-family="sans-serif" letter-spacing="6">EXAMPLE IMAGE</text>
  ${text}
  <text x="600" y="800" font-size="34" text-anchor="middle" fill="#ffffff" fill-opacity="0.85" font-family="sans-serif">${escapeXml(store)}</text>
</svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function findOne<T extends CollectionSlug>(payload: Payload, collection: T, where: Where) {
  const res = await payload.find({
    collection,
    where,
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    context,
  })
  return res.docs[0] as { id: number } | undefined
}

async function upsertMedia(payload: Payload, name: string, alt: string, png: Buffer) {
  const filename = `${slugify(name)}.png`
  const existing = await findOne(payload, 'media', { filename: { equals: filename } })
  if (existing) return existing.id
  const media = await payload.create({
    collection: 'media',
    data: { alt },
    file: { data: png, mimetype: 'image/png', name: filename, size: png.length },
    overrideAccess: true,
    context,
  })
  return media.id
}

// ---------------------------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------------------------

async function seed() {
  // Imported after the production guard above.
  const { default: configPromise } = await import('@payload-config')
  const { getPayload } = await import('payload')
  const payload = await getPayload({ config: configPromise })

  // Site settings (defaults: 09:00 America/New_York)
  await payload.updateGlobal({
    slug: 'site-settings',
    data: { dropTime: '09:00', timezone: 'America/New_York' },
    overrideAccess: true,
    context,
  })
  const settings = await getDropSettings({ payload })
  log(`site settings: drop at ${settings.dropTime} ${settings.timezone}`)

  // Categories
  const categoryIds = new Map<CategoryKey, number>()
  const categoryColors = new Map<CategoryKey, string>()
  for (const c of CATEGORIES) {
    categoryColors.set(c.title, c.color)
    const existing = await findOne(payload, 'categories', { title: { equals: c.title } })
    if (existing) {
      categoryIds.set(c.title, existing.id)
      continue
    }
    const created = await payload.create({
      collection: 'categories',
      data: { title: c.title, slug: slugify(c.title), intro: c.intro },
      overrideAccess: true,
      context,
    })
    categoryIds.set(c.title, created.id)
  }
  log(`categories: ${CATEGORIES.map((c) => c.title).join(', ')}`)

  // Stores: no affiliate relationship yet
  const storeIds = new Map<string, number>()
  for (const s of STORES) {
    const existing = await findOne(payload, 'stores', { name: { equals: s.name } })
    if (existing) {
      storeIds.set(s.name, existing.id)
      continue
    }
    const created = await payload.create({
      collection: 'stores',
      data: {
        name: s.name,
        slug: slugify(s.name),
        domain: s.domain,
        description: 'EXAMPLE COPY. Replace with an original description of this store.',
        affiliateProgram: 'none',
        affiliateStatus: 'none',
        linkTemplate: '{url}',
      },
      overrideAccess: true,
      context,
    })
    storeIds.set(s.name, created.id)
  }
  log(`stores: ${STORES.length}`)

  // Deals (published and live), each with a generated placeholder image
  const dealIds: number[] = []
  const yesterdayDealIndexes = new Set([YESTERDAY_HERO, ...YESTERDAY_PICKS])
  const today = todayInTimezone(new Date(), settings.timezone)
  const yesterday = addDaysToYmd(today, -1)
  const todayPublishAt = computePublishAt(today, settings).toISOString()
  for (const [index, d] of DEALS.entries()) {
    const existing = await findOne(payload, 'deals', { title: { equals: d.title } })
    if (existing) {
      dealIds.push(existing.id)
      continue
    }
    const image = await upsertMedia(
      payload,
      `example-${d.title}`,
      `Placeholder image for ${d.title}`,
      await placeholderImage(d.title, d.store, categoryColors.get(d.category) ?? '#333333'),
    )
    const expired = yesterdayDealIndexes.has(index)
    const created = await payload.create({
      collection: 'deals',
      data: {
        title: d.title,
        slug: slugify(d.title),
        store: storeIds.get(d.store)!,
        category: categoryIds.get(d.category)!,
        productUrl: `https://${STORES.find((s) => s.name === d.store)!.domain}/p/${slugify(d.title)}`,
        image,
        price: d.price,
        wasPrice: d.wasPrice,
        currency: 'USD',
        editorNote: d.note,
        couponCode: d.coupon,
        status: expired ? 'expired' : 'live',
        ...(expired ? { expiresAt: todayPublishAt } : {}),
        _status: 'published',
      },
      overrideAccess: true,
      context,
    })
    dealIds.push(created.id)
  }
  log(`deals: ${DEALS.length}`)

  // Drops: today live, yesterday archived
  const upsertDrop = async (
    date: string,
    status: 'live' | 'archived',
    heroIndex: number,
    pickIndexes: number[],
    intro: string,
  ) => {
    const existing = await findOne(payload, 'drops', { slug: { equals: date } })
    if (existing) {
      await payload.update({
        collection: 'drops',
        id: existing.id,
        data: { status },
        overrideAccess: true,
        context,
      })
      return
    }
    await payload.create({
      collection: 'drops',
      data: {
        date,
        status,
        intro,
        hero: dealIds[heroIndex],
        picks: pickIndexes.map((i) => dealIds[i]),
      },
      overrideAccess: true,
      context,
    })
  }
  await upsertDrop(
    today,
    'live',
    TODAY_HERO,
    TODAY_PICKS,
    'EXAMPLE COPY. Today: a headline pair of headphones and seven picks across tech, home and travel.',
  )
  await upsertDrop(
    yesterday,
    'archived',
    YESTERDAY_HERO,
    YESTERDAY_PICKS,
    'EXAMPLE COPY. Yesterday: a robot vacuum at its lowest price plus six picks.',
  )
  log(`drops: ${today} (live), ${yesterday} (archived)`)

  // Only one drop is live at a time. Earlier seeds (on other days) leave their drop marked live, so
  // archive every live drop that is not today's; the home page shows the newest live drop.
  const stale = await payload.find({
    collection: 'drops',
    where: { and: [{ status: { equals: 'live' } }, { slug: { not_equals: today } }] },
    limit: 100,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    context,
  })
  for (const drop of stale.docs) {
    await payload.update({
      collection: 'drops',
      id: drop.id,
      data: { status: 'archived' },
      overrideAccess: true,
      context,
    })
  }
  if (stale.docs.length > 0) log(`archived ${stale.docs.length} stale live drop(s)`)

  // Back-dated price history. Rows from this step have source "api"; a product key that already has
  // one is skipped, so re-running the seed does not duplicate them.
  const nowMs = Date.now()
  let historyRows = 0
  for (const [indexText, points] of Object.entries(PRICE_HISTORY)) {
    const index = Number(indexText)
    const seed = DEALS[index]
    const productKey = buildProductKey(
      storeIds.get(seed.store)!,
      `https://${STORES.find((s) => s.name === seed.store)!.domain}/p/${slugify(seed.title)}`,
    )
    const existing = await findOne(payload, 'price-snapshots', {
      and: [{ productKey: { equals: productKey } }, { source: { equals: 'api' } }],
    })
    if (existing) continue
    for (const point of points) {
      await payload.create({
        collection: 'price-snapshots',
        data: {
          productKey,
          price: point.price,
          currency: 'USD',
          capturedAt: new Date(nowMs - point.daysAgo * 86_400_000).toISOString(),
          source: 'api',
        },
        overrideAccess: true,
        context,
      })
      historyRows += 1
    }
  }
  log(`price history: ${historyRows} back-dated snapshot(s) added`)

  // Event hub: this year's Black Friday window.
  const year = Number(today.slice(0, 4))
  const existingEvent = await findOne(payload, 'events', { slug: { equals: 'black-friday' } })
  if (!existingEvent) {
    await payload.create({
      collection: 'events',
      data: {
        name: 'Black Friday',
        slug: 'black-friday',
        startsAt: `${year}-11-20T14:00:00.000Z`,
        endsAt: `${year}-12-01T04:59:00.000Z`,
        intro:
          'EXAMPLE COPY. Replace with original text. Our picks for the Black Friday window, limited to deals where the price history shows a real drop.',
        deals: EVENT_DEALS.map((i) => dealIds[i]),
        _status: 'published',
      },
      overrideAccess: true,
      context,
    })
  }
  log('event: black-friday')

  // Always-on offer (the eSIM slot). All values are placeholders.
  const offerImage = await upsertMedia(
    payload,
    'example-esim-offer',
    'Placeholder image for the eSIM offer',
    await placeholderImage('Travel eSIM data plans', 'Example eSIM Partner', '#4a3b78'),
  )
  await payload.updateGlobal({
    slug: 'always-on-offer',
    data: {
      title: 'Travel eSIM data plans',
      partner: 'Example eSIM Partner',
      code: 'EXAMPLE10',
      discountPercent: 10,
      url: 'https://esim.example.com/',
      image: offerImage,
      landingContent: lexical([
        'REPLACE THIS PLACEHOLDER. Write the /esim landing page: what an eSIM is, how to set one up and how to pick a plan.',
        'The partner, code and URL on this offer are examples from the seed script.',
      ]) as never,
    },
    overrideAccess: true,
    context,
  })
  log('always-on offer: eSIM (placeholder partner, code and URL)')

  // Legal page stubs
  for (const p of LEGAL_PAGES) {
    const slug = slugify(p.title)
    const existing = await findOne(payload, 'pages', { slug: { equals: slug } })
    if (existing) continue
    await payload.create({
      collection: 'pages',
      data: {
        title: p.title,
        slug,
        hero: { type: 'lowImpact', richText: lexical([p.title]) as never },
        layout: [
          {
            blockType: 'content',
            columns: [{ size: 'full', richText: lexical(p.body) as never }],
          },
        ],
        _status: 'published',
      },
      overrideAccess: true,
      context,
    })
  }
  log(`pages: ${LEGAL_PAGES.map((p) => slugify(p.title)).join(', ')}`)

  log('done')
}

try {
  await seed()
  process.exit(0)
} catch (err) {
  console.error('[seed] failed:', err)
  process.exit(1)
}
