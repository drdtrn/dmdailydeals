import type { GlobalAfterChangeHook, GlobalConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { isValidDropTime, isValidTimeZone } from '../lib/drops/time'
import { revalidate } from '../lib/revalidate'

const revalidateSiteSettings: GlobalAfterChangeHook = ({ doc, req }) => {
  // The countdown and every "next drop" label live on the home page.
  revalidate({ req, tags: ['site-settings', 'drop:current'] })
  return doc
}

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site settings',
  access: {
    read: anyone,
    update: authenticated,
  },
  fields: [
    {
      name: 'dropTime',
      type: 'text',
      required: true,
      defaultValue: '09:00',
      admin: { description: 'Daily drop time, 24-hour HH:mm, in the timezone below.' },
      validate: (value: string | null | undefined) =>
        isValidDropTime(value) ? true : 'Use 24-hour HH:mm, e.g. 09:00',
    },
    {
      name: 'timezone',
      type: 'text',
      required: true,
      defaultValue: 'America/New_York',
      admin: { description: 'IANA time zone name, e.g. America/New_York.' },
      validate: (value: string | null | undefined) =>
        isValidTimeZone(value) ? true : 'Use a valid IANA time zone, e.g. America/New_York',
    },
    {
      name: 'nextDropOverride',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description:
          'Optional: announce a one-off different time for the next drop. Leave empty normally.',
      },
    },
    {
      name: 'telegramEnabled',
      type: 'checkbox',
      defaultValue: false,
      label: 'Post drops to Telegram',
    },
    {
      name: 'newsletterEnabled',
      type: 'checkbox',
      defaultValue: true,
      label: 'Show newsletter signup',
    },
  ],
  hooks: {
    afterChange: [revalidateSiteSettings],
  },
}
