import type { GlobalAfterChangeHook, GlobalConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { defaultLexical } from '../fields/defaultLexical'
import { metaGroup } from '../fields/seo'
import { revalidate } from '../lib/revalidate'

const revalidateOffer: GlobalAfterChangeHook = ({ doc, req }) => {
  revalidate({ req, tags: ['offer'], paths: ['/esim'] })
  return doc
}

/** The permanent "deal that never expires" slot (the eSIM offer) and its landing page. */
export const AlwaysOnOffer: GlobalConfig = {
  slug: 'always-on-offer',
  label: 'Always-on offer',
  access: {
    read: anyone,
    update: authenticated,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'partner',
      type: 'text',
      required: true,
      admin: { description: 'Name of the partner company.' },
    },
    { name: 'code', type: 'text', admin: { description: 'Discount code, if any.' } },
    { name: 'discountPercent', type: 'number', min: 0, max: 100 },
    {
      name: 'url',
      type: 'text',
      required: true,
      admin: { description: 'Partner landing URL.' },
    },
    { name: 'image', type: 'upload', relationTo: 'media' },
    {
      name: 'landingContent',
      type: 'richText',
      editor: defaultLexical,
      admin: { description: 'Original content for the /esim landing page.' },
    },
    metaGroup(),
  ],
  hooks: {
    afterChange: [revalidateOffer],
  },
}
