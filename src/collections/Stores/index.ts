import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
} from 'payload'

import { slugField } from 'payload'

import { anyone } from '../../access/anyone'
import { authenticated } from '../../access/authenticated'
import { metaGroup } from '../../fields/seo'
import { revalidate } from '../../lib/revalidate'

const revalidateStore: CollectionAfterChangeHook = ({ doc, previousDoc, req }) => {
  revalidate({
    req,
    tags: [
      `store:${doc.slug}`,
      previousDoc?.slug && previousDoc.slug !== doc.slug ? `store:${previousDoc.slug}` : null,
      'sitemap',
    ],
  })
  return doc
}

const revalidateStoreDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
  revalidate({ req, tags: [`store:${doc?.slug}`, 'sitemap'] })
  return doc
}

/** The affiliate setup is internal: only staff and server-side code (overrideAccess) read it. */
const staffOnlyRead = { read: ({ req: { user } }: { req: { user?: unknown } }) => Boolean(user) }

export const Stores: CollectionConfig = {
  slug: 'stores',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['name', 'domain', 'affiliateProgram', 'affiliateStatus', 'updatedAt'],
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'domain',
      type: 'text',
      required: true,
      admin: { description: 'Bare domain, e.g. example.com' },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'description',
      type: 'textarea',
      admin: { description: 'Original copy for the store hub. Do not paste the merchant blurb.' },
    },
    {
      name: 'affiliateProgram',
      type: 'select',
      defaultValue: 'none',
      required: true,
      access: staffOnlyRead,
      admin: { position: 'sidebar' },
      options: [
        { label: 'None', value: 'none' },
        { label: 'eBay Partner Network', value: 'ebay' },
        { label: 'AliExpress', value: 'aliexpress' },
        { label: 'Amazon Associates', value: 'amazon' },
        { label: 'Skimlinks', value: 'skimlinks' },
        { label: 'Sovrn Commerce', value: 'sovrn' },
        { label: 'Awin', value: 'awin' },
        { label: 'Impact', value: 'impact' },
        { label: 'CJ', value: 'cj' },
        { label: 'Direct', value: 'direct' },
      ],
    },
    {
      name: 'affiliateStatus',
      type: 'select',
      defaultValue: 'none',
      required: true,
      access: staffOnlyRead,
      admin: {
        position: 'sidebar',
        description: 'Switching to Active monetises every existing deal from this store.',
      },
      options: [
        { label: 'None', value: 'none' },
        { label: 'Pending', value: 'pending' },
        { label: 'Active', value: 'active' },
      ],
    },
    {
      name: 'linkTemplate',
      type: 'text',
      defaultValue: '{url}',
      required: true,
      access: staffOnlyRead,
      admin: {
        position: 'sidebar',
        description:
          'Outbound link pattern. {url} is the raw product URL, {encodedUrl} is URL-encoded (for network deep links).',
      },
      validate: (value: string | null | undefined) => {
        if (!value) return 'Link template is required'
        if (!value.includes('{url}') && !value.includes('{encodedUrl}')) {
          return 'The template must contain {url} or {encodedUrl}'
        }
        return true
      },
    },
    slugField({ useAsSlug: 'name' }),
    metaGroup(),
  ],
  hooks: {
    afterChange: [revalidateStore],
    afterDelete: [revalidateStoreDelete],
  },
}
