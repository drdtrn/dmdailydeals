import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'

/**
 * Our own newsletter list. No public access at all: signups are written server-side.
 * PRIVACY: no raw IP address is stored, only the consent facts below.
 */
export const Subscribers: CollectionConfig = {
  slug: 'subscribers',
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['email', 'status', 'source', 'consentAt'],
    useAsTitle: 'email',
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
      hooks: {
        beforeValidate: [
          ({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
        ],
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Unsubscribed', value: 'unsubscribed' },
      ],
    },
    {
      name: 'source',
      type: 'text',
      admin: { description: 'Which page or call to action the signup came from.' },
    },
    {
      name: 'consentAt',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'consentText',
      type: 'text',
      admin: { description: 'Version or wording of the signup consent text shown to the person.' },
    },
    {
      name: 'confirmedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Empty until email delivery (and double opt-in) exists.',
      },
    },
  ],
}
