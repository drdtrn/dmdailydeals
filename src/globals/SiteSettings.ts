import type { GlobalAfterChangeHook, GlobalConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { staffOnlyField } from '../access/staffOnlyField'
import { isValidDropTime, isValidTimeZone } from '../lib/drops/time'
import { safeHttpUrl } from '../lib/safeUrl'
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
      admin: {
        description:
          'Also needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID in the environment (see the README).',
      },
    },
    {
      name: 'telegramChannelUrl',
      type: 'text',
      label: 'Telegram channel URL',
      admin: {
        description:
          'Public link shown on the signup box, e.g. https://t.me/dmdailydeals. Leave empty to hide it.',
      },
      validate: (value: string | null | undefined) =>
        !value || safeHttpUrl(value)
          ? true
          : 'Use a full http(s) URL, e.g. https://t.me/dmdailydeals',
    },
    {
      // Internal: staff-only read so the public global endpoint never exposes it. The API keys are
      // NOT here; they live in the environment (see .env.example). This group holds the choices.
      name: 'ai',
      label: 'AI blog drafts',
      type: 'group',
      access: { read: staffOnlyField },
      admin: {
        description:
          'Controls the blog draft generator. Keys are set in the environment, never here.',
      },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: false,
          label: 'Generate drafts from briefs',
          admin: {
            description:
              'Off by default. A new brief fails with a clear message while this is off. Also needs the API keys in the environment.',
          },
        },
        {
          name: 'provider',
          type: 'select',
          options: [
            { label: 'DeepSeek', value: 'deepseek' },
            { label: 'OpenAI', value: 'openai' },
          ],
          admin: { description: 'Leave empty to use AI_PROVIDER from the environment.' },
        },
        {
          name: 'model',
          type: 'text',
          admin: {
            description:
              "Leave empty for the provider's default model (deepseek-flash, gpt-6-luna). The AI_MODEL environment variable overrides this.",
          },
        },
        {
          name: 'monthlyDraftCap',
          type: 'number',
          defaultValue: 20,
          min: 0,
          admin: {
            description:
              'Most drafts that may be started per calendar month (UTC). Protects the budget.',
          },
        },
      ],
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
