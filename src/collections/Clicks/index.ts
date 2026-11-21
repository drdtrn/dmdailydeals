import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'

/**
 * Outbound click log, written by `/go/[id]` (Phase 3) with the Local API.
 *
 * PRIVACY: never add an IP address (raw or hashed) or user-agent field here. Country comes from
 * Cloudflare's `CF-IPCountry` header; `isBot` is derived from the user agent at write time and only
 * the boolean is stored.
 */
export const Clicks: CollectionConfig = {
  slug: 'clicks',
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  admin: {
    // Hidden from the admin nav. Reporting reads this through the Local API.
    hidden: true,
    defaultColumns: ['deal', 'store', 'at', 'isBot'],
  },
  fields: [
    {
      name: 'deal',
      type: 'relationship',
      relationTo: 'deals',
      required: true,
      index: true,
    },
    {
      name: 'store',
      type: 'relationship',
      relationTo: 'stores',
      required: true,
      index: true,
    },
    {
      name: 'at',
      type: 'date',
      required: true,
      index: true,
      defaultValue: () => new Date().toISOString(),
    },
    {
      name: 'fromPath',
      type: 'text',
      admin: { description: 'Page the click came from, e.g. /deal/some-slug' },
    },
    {
      name: 'utm',
      type: 'group',
      fields: [
        { name: 'source', type: 'text' },
        { name: 'medium', type: 'text' },
        { name: 'campaign', type: 'text' },
        { name: 'content', type: 'text' },
        { name: 'term', type: 'text' },
      ],
    },
    {
      name: 'country',
      type: 'text',
      maxLength: 2,
      admin: { description: 'ISO 3166-1 alpha-2 from CF-IPCountry' },
    },
    {
      name: 'isBot',
      type: 'checkbox',
      defaultValue: false,
      index: true,
    },
  ],
}
