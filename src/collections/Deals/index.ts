import type { CollectionConfig } from 'payload'

import { slugField } from 'payload'

import { authenticated } from '../../access/authenticated'
import { authenticatedOrPublishedLive } from '../../access/authenticatedOrPublishedLive'
import { seoTab } from '../../fields/seo'
import { prepareDeal, revalidateDeal, revalidateDealDelete, snapshotPrice } from './hooks'

export const EDITOR_NOTE_MIN_LENGTH = 140

export const Deals: CollectionConfig<'deals'> = {
  slug: 'deals',
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublishedLive,
    update: authenticated,
  },
  defaultPopulate: {
    title: true,
    slug: true,
    store: true,
    category: true,
    image: true,
    price: true,
    wasPrice: true,
    currency: true,
    status: true,
    expiresAt: true,
  },
  admin: {
    defaultColumns: ['title', 'store', 'category', 'price', 'status', 'expiresAt'],
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Deal',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'store',
                  type: 'relationship',
                  relationTo: 'stores',
                  required: true,
                  admin: { width: '50%' },
                },
                {
                  name: 'category',
                  type: 'relationship',
                  relationTo: 'categories',
                  required: true,
                  admin: { width: '50%' },
                },
              ],
            },
            {
              name: 'productUrl',
              type: 'text',
              required: true,
              admin: {
                description: 'Plain product page URL (no affiliate or tracking parameters).',
              },
              validate: (value: string | null | undefined) => {
                if (!value) return 'Product URL is required'
                try {
                  const url = new URL(value)
                  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                    return 'Product URL must start with http:// or https://'
                  }
                  return true
                } catch {
                  return 'Product URL must be a valid URL'
                }
              },
            },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'price',
                  type: 'number',
                  required: true,
                  min: 0,
                  admin: { width: '33%' },
                },
                {
                  name: 'wasPrice',
                  type: 'number',
                  min: 0,
                  admin: { width: '33%', description: 'Regular price before the discount.' },
                  validate: (
                    value: number | null | undefined,
                    { siblingData }: { siblingData: { price?: number } },
                  ) => {
                    if (value === null || value === undefined) return true
                    if (typeof siblingData?.price === 'number' && value <= siblingData.price) {
                      return 'Was price must be higher than the current price'
                    }
                    return true
                  },
                },
                {
                  name: 'currency',
                  type: 'text',
                  required: true,
                  defaultValue: 'USD',
                  admin: { width: '33%', description: 'ISO 4217 code, e.g. USD.' },
                  validate: (value: string | null | undefined) =>
                    value && /^[A-Z]{3}$/.test(value)
                      ? true
                      : 'Use a 3-letter uppercase currency code',
                },
              ],
            },
            {
              name: 'priceCheckedAt',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
                description:
                  'When you last confirmed this price. Shown as "Price checked <time>". Set automatically when the price changes.',
              },
            },
            {
              name: 'editorNote',
              type: 'textarea',
              required: true,
              admin: {
                description: `Why this is a deal, in your own words (at least ${EDITOR_NOTE_MIN_LENGTH} characters). Original copy only; do not paste the merchant description.`,
              },
              validate: (value: string | null | undefined) => {
                const length = (value ?? '').trim().length
                if (length < EDITOR_NOTE_MIN_LENGTH) {
                  return `The editor note must be at least ${EDITOR_NOTE_MIN_LENGTH} characters (currently ${length}).`
                }
                return true
              },
            },
            {
              name: 'couponCode',
              type: 'text',
            },
          ],
        },
        seoTab(),
      ],
    },
    {
      name: 'status',
      type: 'select',
      // Distinct enum name: Payload's own draft `_status` column already owns `enum_deals_status`.
      enumName: 'enum_deals_lifecycle',
      required: true,
      defaultValue: 'live',
      index: true,
      admin: {
        position: 'sidebar',
        description:
          'Lifecycle: expired and sold-out deals keep their page. "Draft" keeps a published deal hidden from the public.',
      },
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Live', value: 'live' },
        { label: 'Expired', value: 'expired' },
        { label: 'Sold out', value: 'sold-out' },
      ],
    },
    {
      name: 'startsAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        position: 'sidebar',
        description: 'Defaults to now.',
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      index: true,
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        position: 'sidebar',
        description: 'Defaults to the next drop time (see Site settings).',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [
          ({ siblingData, value }) => {
            if (siblingData._status === 'published' && !value) {
              return new Date().toISOString()
            }
            return value
          },
        ],
      },
    },
    slugField(),
  ],
  hooks: {
    beforeChange: [prepareDeal],
    afterChange: [snapshotPrice, revalidateDeal],
    afterDelete: [revalidateDealDelete],
  },
  versions: {
    drafts: {
      // Autosave only writes draft versions. Side-effect hooks (snapshots, revalidation) check
      // `_status === 'published'`, so autosaves never trigger them.
      autosave: {
        interval: 2000,
      },
    },
    maxPerDoc: 25,
  },
}
