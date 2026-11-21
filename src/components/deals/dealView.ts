import type { Category, Deal, Store } from '@/payload-types'

/**
 * The slice of a Deal the UI needs. A full `Deal` fits; relations may be populated
 * (depth >= 1) or still ids. Pages should populate `store`, `category` and `image`.
 */
export type DealView = Pick<
  Deal,
  'id' | 'slug' | 'title' | 'price' | 'wasPrice' | 'currency' | 'priceCheckedAt' | 'status'
> & {
  editorNote?: Deal['editorNote']
  image?: Deal['image']
  store: number | Pick<Store, 'name' | 'slug'>
  category: number | Pick<Category, 'title' | 'slug'>
}

export const storeOf = (deal: DealView) => (typeof deal.store === 'object' ? deal.store : null)
export const categoryOf = (deal: DealView) =>
  typeof deal.category === 'object' ? deal.category : null

/** Expired and sold-out deals keep their page but lose the buy CTA. */
export const isUnavailable = (deal: Pick<DealView, 'status'>) =>
  deal.status === 'expired' || deal.status === 'sold-out'

export const unavailableLabel = (deal: Pick<DealView, 'status'>) =>
  deal.status === 'sold-out' ? 'Sold out' : 'Expired'

export const dealHref = (deal: Pick<DealView, 'slug'>) => `/deal/${deal.slug}`
export const goHref = (deal: Pick<DealView, 'id'>) => `/go/${deal.id}`
