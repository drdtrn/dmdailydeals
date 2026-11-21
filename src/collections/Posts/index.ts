import type { CollectionConfig } from 'payload'

import { slugField } from 'payload'

import { authenticated } from '../../access/authenticated'
import { authenticatedOrPublished } from '../../access/authenticatedOrPublished'
import { staffOnlyField } from '../../access/staffOnlyField'
import { seoTab } from '../../fields/seo'
import { safeHttpUrl } from '../../lib/safeUrl'
import { generatePreviewPath } from '../../utilities/generatePreviewPath'
import { postContentEditor } from './editor'
import { populateAuthor } from './hooks/populateAuthor'
import { publishGate } from './hooks/publishGate'
import { revalidateDelete, revalidatePost } from './hooks/revalidatePost'

export const Posts: CollectionConfig<'posts'> = {
  slug: 'posts',
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  // What is populated when a post is referenced from another document. Nothing internal here:
  // `aiAssisted`, `reviewedBy` and the brief are not part of it (and are staff-only fields anyway).
  defaultPopulate: {
    title: true,
    slug: true,
    category: true,
    heroImage: true,
    publishedAt: true,
    meta: {
      image: true,
      description: true,
    },
  },
  admin: {
    defaultColumns: ['title', 'category', '_status', 'aiAssisted', 'reviewedBy', 'updatedAt'],
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: 'posts',
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: 'posts',
        req,
      }),
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
          label: 'Content',
          fields: [
            { name: 'heroImage', type: 'upload', relationTo: 'media' },
            {
              name: 'content',
              type: 'richText',
              editor: postContentEditor,
              label: false,
              required: true,
            },
          ],
        },
        {
          label: 'Sources and links',
          fields: [
            {
              name: 'sources',
              type: 'array',
              labels: { singular: 'Source', plural: 'Sources' },
              admin: {
                description:
                  'Pages the guide is based on. Shown as a "Sources" list under the post.',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'title', type: 'text', required: true, admin: { width: '40%' } },
                    {
                      name: 'url',
                      type: 'text',
                      required: true,
                      admin: { width: '60%' },
                      validate: (value: string | null | undefined) =>
                        value && safeHttpUrl(value) ? true : 'Use a full http(s) URL',
                    },
                  ],
                },
              ],
            },
            {
              name: 'relatedDeals',
              type: 'relationship',
              relationTo: 'deals',
              hasMany: true,
              admin: {
                description:
                  'Live deals shown under the post (with the affiliate disclosure). Only deals that are live are displayed.',
              },
            },
            {
              name: 'relatedPosts',
              type: 'relationship',
              relationTo: 'posts',
              hasMany: true,
              filterOptions: ({ id }) => ({ id: { not_in: [id] } }),
            },
          ],
        },
        seoTab(),
      ],
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
              return new Date()
            }
            return value
          },
        ],
      },
    },
    {
      // One category per guide: it decides the hub the guide appears on ("Latest guides") and its
      // breadcrumb. A guide that spans categories is two guides.
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      admin: { position: 'sidebar' },
    },
    {
      // A real person. The public fields come from the user's profile (see `populatedAuthor`).
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar' },
    },
    {
      // Virtual (never stored): the author's PUBLIC profile fields, filled by `populateAuthor`.
      // The `users` collection is staff-only, so this is how public pages get a byline.
      name: 'populatedAuthor',
      type: 'json',
      virtual: true,
      access: { create: () => false, update: () => false },
      admin: { disabled: true, readOnly: true },
    },
    // --- Internal review fields. Staff-only at the FIELD level: anonymous API responses omit them.
    {
      name: 'aiAssisted',
      type: 'checkbox',
      defaultValue: false,
      access: { read: staffOnlyField },
      admin: {
        position: 'sidebar',
        description:
          'Internal only. Never shown on the site or returned to the public. While this is on, the post cannot be published until "Reviewed by" is set.',
      },
    },
    {
      name: 'reviewedBy',
      type: 'relationship',
      relationTo: 'users',
      access: { read: staffOnlyField },
      admin: {
        position: 'sidebar',
        description:
          'The person who read and approved this post. Required to publish an AI-assisted post.',
      },
    },
    {
      name: 'reviewedAt',
      type: 'date',
      access: { read: staffOnlyField },
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Set automatically when a reviewer is chosen.',
      },
    },
    {
      // The brief this draft came from (the brief's `post` field points here).
      name: 'brief',
      type: 'join',
      collection: 'blog-briefs',
      on: 'post',
      defaultLimit: 1,
      maxDepth: 0,
      access: { read: staffOnlyField },
      admin: { position: 'sidebar', defaultColumns: ['topic', 'status', 'createdAt'] },
    },
    slugField(),
  ],
  hooks: {
    beforeChange: [publishGate],
    afterChange: [revalidatePost],
    afterRead: [populateAuthor],
    afterDelete: [revalidateDelete],
  },
  versions: {
    drafts: {
      autosave: {
        interval: 100, // We set this interval for optimal live preview
      },
      schedulePublish: true,
    },
    maxPerDoc: 50,
  },
}
