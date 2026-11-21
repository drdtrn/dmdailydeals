import type { DealView } from '@/components/deals/dealView'
import type { AlwaysOnOffer, Media } from '@/payload-types'

const stores = {
  amazon: { name: 'Amazon', slug: 'amazon' },
  ebay: { name: 'eBay', slug: 'ebay' },
  aliexpress: { name: 'AliExpress', slug: 'aliexpress' },
}
const categories = {
  home: { title: 'Home', slug: 'home' },
  tech: { title: 'Tech', slug: 'tech' },
  travel: { title: 'Travel', slug: 'travel' },
}

/** A populated media doc that points at a file in /public, to exercise next/image. */
export const sampleImage: Media = {
  id: 1,
  alt: 'Sample product photo',
  url: '/brand/og-default.png',
  width: 1200,
  height: 630,
  updatedAt: '2026-11-21T14:00:00.000Z',
  createdAt: '2026-11-21T14:00:00.000Z',
}

const checked = '2026-11-21T14:14:00.000Z' // 9:14 AM ET

export const heroDeal: DealView = {
  id: 101,
  slug: 'noise-cancelling-wireless-headphones',
  title: 'Noise-cancelling wireless headphones',
  store: stores.amazon,
  category: categories.tech,
  price: 229,
  wasPrice: 369,
  currency: 'USD',
  priceCheckedAt: checked,
  status: 'live',
  editorNote:
    'The lowest price we have tracked in 90 days, and $40 under its previous low. A strong pick for long flights. (Fixture copy for the style guide.)',
}

export const heroWithImage: DealView = { ...heroDeal, id: 102, image: sampleImage }

export const heroExpired: DealView = {
  ...heroDeal,
  id: 103,
  status: 'expired',
}

export const picks: { deal: DealView; lowest: boolean }[] = [
  {
    lowest: true,
    deal: {
      id: 1,
      slug: 'robot-vacuum-self-empty-base',
      title: 'Robot vacuum with self-empty base',
      store: stores.amazon,
      category: categories.home,
      price: 199,
      wasPrice: 289,
      currency: 'USD',
      priceCheckedAt: checked,
      status: 'live',
    },
  },
  {
    lowest: false,
    deal: {
      id: 2,
      slug: 'hard-shell-carry-on-22',
      title: 'Hard-shell carry-on, 22 in',
      store: stores.ebay,
      category: categories.travel,
      price: 119,
      wasPrice: 152,
      currency: 'USD',
      priceCheckedAt: checked,
      status: 'live',
    },
  },
  {
    lowest: true,
    deal: {
      id: 3,
      slug: 'usb-c-gan-charger-65w',
      title: '65W USB-C GaN charger, 3 ports',
      store: stores.aliexpress,
      category: categories.tech,
      price: 29,
      wasPrice: 48,
      currency: 'USD',
      priceCheckedAt: checked,
      status: 'live',
      image: sampleImage,
    },
  },
  {
    lowest: false,
    deal: {
      id: 4,
      slug: 'travel-adapter-usb-c',
      title: 'Universal travel adapter with USB-C and a very long title that wraps to a third line',
      store: stores.amazon,
      category: categories.travel,
      price: 22.5,
      wasPrice: null,
      currency: 'USD',
      priceCheckedAt: checked,
      status: 'live',
    },
  },
]

export const expiredCard: DealView = {
  id: 5,
  slug: 'cordless-stick-vacuum',
  title: 'Cordless stick vacuum',
  store: stores.aliexpress,
  category: categories.home,
  price: 89,
  wasPrice: 139,
  currency: 'USD',
  priceCheckedAt: '2026-11-20T14:02:00.000Z',
  status: 'expired',
}

export const soldOutCard: DealView = {
  ...expiredCard,
  id: 6,
  slug: 'packing-cubes-set-of-6',
  title: 'Packing cubes, set of 6',
  store: stores.amazon,
  category: categories.travel,
  price: 18,
  wasPrice: 26,
  status: 'sold-out',
}

export const offer: Pick<AlwaysOnOffer, 'title' | 'partner' | 'code'> = {
  title: '10% off travel eSIMs',
  partner: 'Example eSIM Co.',
  code: 'EXAMPLE10',
}
