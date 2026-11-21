import type { CollectionAfterChangeHook, CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { revalidate } from '../../lib/revalidate'
import { safeHttpUrl } from '../../lib/safeUrl'

/** A byline edit (name, bio, avatar, links) shows on every post the next time it is read. */
const revalidateAuthorPosts: CollectionAfterChangeHook = ({ doc, req }) => {
  revalidate({ req, tags: ['posts'] })
  return doc
}

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['name', 'email'],
    useAsTitle: 'name',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    // Public author fields (blog bylines). Public pages may read ONLY these fields, through
    // `getPublicAuthor` (src/lib/authors.ts); the collection itself stays staff-only, so emails and
    // auth data are never reachable. Bylines are real people: no invented personas.
    {
      type: 'collapsible',
      label: 'Public author profile',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'displayName',
          type: 'text',
          admin: { description: 'The name shown in blog bylines. Use a real name.' },
        },
        {
          name: 'bio',
          type: 'textarea',
          maxLength: 400,
          admin: { description: 'One or two sentences, shown under the byline.' },
        },
        { name: 'avatar', type: 'upload', relationTo: 'media' },
        {
          name: 'sameAs',
          type: 'array',
          label: 'Profile links',
          admin: {
            description:
              'Links to this person on other sites (LinkedIn, X, a personal site). Used for the author markup.',
          },
          fields: [
            {
              name: 'url',
              type: 'text',
              required: true,
              validate: (value: string | null | undefined) =>
                !value || safeHttpUrl(value) ? true : 'Use a full http(s) URL',
            },
          ],
        },
      ],
    },
  ],
  hooks: { afterChange: [revalidateAuthorPosts] },
  timestamps: true,
}
