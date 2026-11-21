import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
} from 'payload'

import type { Deal } from '../../payload-types'

import { buildProductKey } from '../../lib/deals/productKey'
import { getDropSettings } from '../../lib/drops/settings'
import { getNextDropAt } from '../../lib/drops/time'
import { relId } from '../../lib/relId'
import { revalidate, revalidationDisabled } from '../../lib/revalidate'
import { slugOf } from '../../lib/slugOf'

/**
 * Fills defaults that depend on other data or on site settings:
 * - `expiresAt` defaults to the next drop (in the site-settings timezone)
 * - `startsAt` defaults to now
 * - `priceCheckedAt` is set to now on create and whenever the price changes without the editor
 *   also touching the timestamp
 *
 * This only edits the data being saved: it has no side effects outside the document, so it is
 * safe for autosave.
 */
export const prepareDeal: CollectionBeforeChangeHook<Deal> = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const now = new Date()
  const next = { ...data }

  if (!next.startsAt) next.startsAt = now.toISOString()

  if (!next.expiresAt) {
    const settings = await getDropSettings(req)
    next.expiresAt = getNextDropAt(now, settings).toISOString()
  }

  if (operation === 'create') {
    if (!next.priceCheckedAt) next.priceCheckedAt = now.toISOString()
  } else if (originalDoc) {
    const priceChanged = next.price !== undefined && next.price !== originalDoc.price
    const stampUntouched =
      !next.priceCheckedAt || next.priceCheckedAt === originalDoc.priceCheckedAt
    if (priceChanged && stampUntouched) next.priceCheckedAt = now.toISOString()
  }

  return next
}

/**
 * Inserts exactly one `price-snapshots` row per real price change.
 *
 * Fires only for published saves, so drafts and autosaves (which are saved as draft versions and
 * report `_status: 'draft'`) never write. It runs when the deal is first published or when
 * price, currency or product key changed since the published version, and is idempotent: it
 * skips when the newest snapshot for the key already holds the same price and currency
 * (e.g. unpublish then republish at an unchanged price).
 */
export const snapshotPrice: CollectionAfterChangeHook<Deal> = async ({ doc, previousDoc, req }) => {
  if (doc._status !== 'published') return doc

  const storeId = relId(doc.store)
  if (storeId === undefined || !doc.productUrl) return doc

  let productKey: string
  try {
    productKey = buildProductKey(storeId, doc.productUrl)
  } catch {
    return doc
  }

  const wasPublished = previousDoc?._status === 'published'
  let previousKey: string | undefined
  if (wasPublished && previousDoc.productUrl) {
    const previousStoreId = relId(previousDoc.store)
    try {
      previousKey =
        previousStoreId === undefined
          ? undefined
          : buildProductKey(previousStoreId, previousDoc.productUrl)
    } catch {
      previousKey = undefined
    }
  }

  const changed =
    !wasPublished ||
    previousDoc.price !== doc.price ||
    previousDoc.currency !== doc.currency ||
    previousKey !== productKey
  if (!changed) return doc

  const latest = await req.payload.find({
    collection: 'price-snapshots',
    where: { productKey: { equals: productKey } },
    sort: '-capturedAt',
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  const last = latest.docs[0]
  if (last && last.price === doc.price && last.currency === doc.currency) return doc

  await req.payload.create({
    collection: 'price-snapshots',
    data: {
      productKey,
      price: doc.price,
      currency: doc.currency,
      capturedAt: new Date().toISOString(),
      source: 'manual',
    },
    overrideAccess: true,
    req,
  })

  return doc
}

async function dealTags(
  req: Parameters<CollectionAfterChangeHook<Deal>>[0]['req'],
  deal: Partial<Deal> | undefined,
) {
  if (!deal) return []
  const [category, store] = await Promise.all([
    slugOf(req, 'categories', relId(deal.category)),
    slugOf(req, 'stores', relId(deal.store)),
  ])
  return [
    deal.id !== undefined ? `deal:${deal.id}` : null,
    category ? `category:${category}` : null,
    store ? `store:${store}` : null,
  ]
}

export const revalidateDeal: CollectionAfterChangeHook<Deal> = async ({
  doc,
  previousDoc,
  req,
}) => {
  if (revalidationDisabled(req)) return doc

  const visibleNow = doc._status === 'published'
  const wasVisible = previousDoc?._status === 'published'
  if (!visibleNow && !wasVisible) return doc

  try {
    revalidate({
      req,
      tags: [
        ...(await dealTags(req, doc)),
        ...(wasVisible ? await dealTags(req, previousDoc) : []),
        'drop:current',
        'drops',
        'sitemap',
      ],
    })
  } catch (err) {
    req.payload.logger.warn({ err, msg: 'Deal revalidation skipped' })
  }
  return doc
}

export const revalidateDealDelete: CollectionAfterDeleteHook<Deal> = async ({ doc, req }) => {
  if (revalidationDisabled(req)) return doc
  try {
    revalidate({
      req,
      tags: [...(await dealTags(req, doc)), 'drop:current', 'drops', 'sitemap'],
    })
  } catch (err) {
    req.payload.logger.warn({ err, msg: 'Deal revalidation skipped' })
  }
  return doc
}
