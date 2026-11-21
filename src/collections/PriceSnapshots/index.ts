import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'

/**
 * Price history, keyed by `productKey` (store + normalised product URL). Written server-side by
 * the deals afterChange hook. There is no public read: the frontend reads it with the Local API.
 */
export const PriceSnapshots: CollectionConfig = {
  slug: 'price-snapshots',
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['productKey', 'price', 'currency', 'capturedAt', 'source'],
    useAsTitle: 'productKey',
  },
  fields: [
    {
      name: 'productKey',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'currency',
      type: 'text',
      required: true,
      defaultValue: 'USD',
    },
    {
      name: 'capturedAt',
      type: 'date',
      required: true,
      index: true,
      defaultValue: () => new Date().toISOString(),
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'manual',
      options: [
        { label: 'Manual', value: 'manual' },
        { label: 'API', value: 'api' },
      ],
    },
  ],
}
