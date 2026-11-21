import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
} from 'payload'

import type { Drop } from '../../payload-types'

import { getDropSettings } from '../../lib/drops/settings'
import { computePublishAt, ymdFromDateValue } from '../../lib/drops/time'
import { revalidate } from '../../lib/revalidate'

/**
 * Normalises `date` to noon UTC of the chosen calendar day (so the stored value is stable no matter
 * which clock the admin browser uses) and derives the `YYYY-MM-DD` slug from it.
 */
export const normaliseDropDate: CollectionBeforeValidateHook<Drop> = ({ data }) => {
  if (!data?.date) return data
  const ymd = ymdFromDateValue(data.date)
  return { ...data, date: `${ymd}T12:00:00.000Z`, slug: ymd }
}

/** `publishAt` = drop time on `date` in the site-settings timezone. Always recomputed on save. */
export const computeDropPublishAt: CollectionBeforeChangeHook<Drop> = async ({ data, req }) => {
  if (!data?.date) return data
  const settings = await getDropSettings(req)
  return {
    ...data,
    publishAt: computePublishAt(ymdFromDateValue(data.date), settings).toISOString(),
  }
}

export const revalidateDrop: CollectionAfterChangeHook<Drop> = ({ doc, previousDoc, req }) => {
  revalidate({
    req,
    tags: [
      'drops',
      'drop:current',
      `drop:${doc.slug}`,
      previousDoc?.slug && previousDoc.slug !== doc.slug ? `drop:${previousDoc.slug}` : null,
      'sitemap',
    ],
  })
  return doc
}

export const revalidateDropDelete: CollectionAfterDeleteHook<Drop> = ({ doc, req }) => {
  revalidate({ req, tags: ['drops', 'drop:current', `drop:${doc?.slug}`, 'sitemap'] })
  return doc
}
