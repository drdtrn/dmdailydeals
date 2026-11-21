import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
} from 'payload'

import { slugField } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { metaGroup } from '../fields/seo'
import { revalidate } from '../lib/revalidate'

const revalidateCategory: CollectionAfterChangeHook = ({ doc, previousDoc, req }) => {
  revalidate({
    req,
    tags: [
      'categories',
      `category:${doc.slug}`,
      previousDoc?.slug && previousDoc.slug !== doc.slug ? `category:${previousDoc.slug}` : null,
      'sitemap',
    ],
  })
  return doc
}

const revalidateCategoryDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
  revalidate({ req, tags: ['categories', `category:${doc?.slug}`, 'sitemap'] })
  return doc
}

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'intro',
      type: 'textarea',
      admin: {
        description:
          'Original SEO copy shown at the top of the category hub (a short paragraph or two).',
      },
    },
    slugField({
      position: undefined,
    }),
    metaGroup(),
  ],
  hooks: {
    afterChange: [revalidateCategory],
    afterDelete: [revalidateCategoryDelete],
  },
}
