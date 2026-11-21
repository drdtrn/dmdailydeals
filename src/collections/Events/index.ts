import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
} from 'payload'

import { slugField } from 'payload'

import { authenticated } from '../../access/authenticated'
import { authenticatedOrPublished } from '../../access/authenticatedOrPublished'
import { seoTab } from '../../fields/seo'
import { revalidate } from '../../lib/revalidate'

const revalidateEvent: CollectionAfterChangeHook = ({ doc, previousDoc, req }) => {
  const visible = doc._status === 'published'
  const wasVisible = previousDoc?._status === 'published'
  if (visible || wasVisible) {
    revalidate({
      req,
      tags: [
        'events',
        `event:${doc.slug}`,
        previousDoc?.slug && previousDoc.slug !== doc.slug ? `event:${previousDoc.slug}` : null,
        'sitemap',
      ],
    })
  }
  return doc
}

const revalidateEventDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
  revalidate({ req, tags: ['events', `event:${doc?.slug}`, 'sitemap'] })
  return doc
}

/** Recurring sale events (Black Friday etc.) with fixed URLs reused every year. */
export const Events: CollectionConfig<'events'> = {
  slug: 'events',
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['name', 'slug', 'startsAt', 'endsAt'],
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Event',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'startsAt',
                  type: 'date',
                  admin: {
                    width: '50%',
                    description: "This year's window. Update it each year; the URL stays the same.",
                  },
                },
                { name: 'endsAt', type: 'date', admin: { width: '50%' } },
              ],
            },
            {
              name: 'intro',
              type: 'textarea',
              admin: { description: 'Original copy for the event hub.' },
            },
            {
              name: 'deals',
              type: 'relationship',
              relationTo: 'deals',
              hasMany: true,
            },
          ],
        },
        seoTab(),
      ],
    },
    slugField({ useAsSlug: 'name' }),
  ],
  hooks: {
    afterChange: [revalidateEvent],
    afterDelete: [revalidateEventDelete],
  },
  versions: {
    drafts: {
      autosave: { interval: 2000 },
    },
    maxPerDoc: 10,
  },
}
