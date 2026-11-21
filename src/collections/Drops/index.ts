import type { CollectionConfig, PayloadRequest } from 'payload'

import { authenticated } from '../../access/authenticated'
import { authenticatedOrLiveDrop } from '../../access/authenticatedOrLiveDrop'
import { relId } from '../../lib/relId'
import {
  computeDropPublishAt,
  normaliseDropDate,
  revalidateDrop,
  revalidateDropDelete,
} from './hooks'

export const MIN_PICKS = 5
export const MAX_PICKS = 10

export const Drops: CollectionConfig<'drops'> = {
  slug: 'drops',
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrLiveDrop,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['slug', 'status', 'hero', 'publishAt'],
    useAsTitle: 'slug',
  },
  fields: [
    {
      name: 'date',
      type: 'date',
      required: true,
      unique: true,
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description: 'The calendar day of this drop. One drop per day.',
      },
      validate: async (
        value: Date | string | null | undefined,
        { id, req }: { id?: number | string; req: PayloadRequest },
      ) => {
        if (!value) return 'Date is required'
        // `unique: true` also enforces this in the database; this check gives a clear message.
        const existing = await req.payload.find({
          collection: 'drops',
          where: {
            and: [
              { date: { equals: value } },
              ...(id !== undefined ? [{ id: { not_equals: id } }] : []),
            ],
          },
          limit: 1,
          depth: 0,
          pagination: false,
          overrideAccess: true,
          req,
        })
        return existing.totalDocs > 0 ? 'A drop already exists for this date.' : true
      },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Derived from the date (YYYY-MM-DD).',
      },
    },
    {
      name: 'hero',
      type: 'relationship',
      relationTo: 'deals',
      required: true,
      admin: { description: 'The featured deal. It must not also be one of the picks.' },
    },
    {
      name: 'picks',
      type: 'relationship',
      relationTo: 'deals',
      hasMany: true,
      required: true,
      admin: {
        description: `Between ${MIN_PICKS} and ${MAX_PICKS} deals, in display order.`,
      },
      validate: (value: unknown, { siblingData }: { siblingData: { hero?: unknown } }) => {
        const picks = Array.isArray(value) ? value : []
        if (picks.length < MIN_PICKS || picks.length > MAX_PICKS) {
          return `A drop needs ${MIN_PICKS} to ${MAX_PICKS} picks (currently ${picks.length}).`
        }
        const ids = picks.map((p) => String(relId(p)))
        if (new Set(ids).size !== ids.length) return 'A deal can only appear once in the picks.'
        const heroId = relId(siblingData?.hero)
        if (heroId !== undefined && ids.includes(String(heroId))) {
          return 'The hero deal must not also be one of the picks.'
        }
        return true
      },
    },
    {
      name: 'intro',
      type: 'textarea',
      admin: { description: 'Short original intro for the drop page.' },
    },
    {
      name: 'publishAt',
      type: 'date',
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Computed from the date, drop time and timezone in Site settings.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'scheduled',
      index: true,
      admin: { position: 'sidebar' },
      options: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Live', value: 'live' },
        { label: 'Archived', value: 'archived' },
      ],
    },
  ],
  hooks: {
    beforeValidate: [normaliseDropDate],
    beforeChange: [computeDropPublishAt],
    afterChange: [revalidateDrop],
    afterDelete: [revalidateDropDelete],
  },
}
