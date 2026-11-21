import type { Field, Tab } from 'payload'

import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'

/** The SEO `meta` group used by the template collections, as a reusable field. */
export const metaGroup = (): Field => ({
  name: 'meta',
  label: 'SEO',
  type: 'group',
  fields: [
    OverviewField({
      titlePath: 'meta.title',
      descriptionPath: 'meta.description',
      imagePath: 'meta.image',
    }),
    MetaTitleField({ hasGenerateFn: true }),
    MetaImageField({ relationTo: 'media' }),
    MetaDescriptionField({}),
    PreviewField({
      hasGenerateFn: true,
      titlePath: 'meta.title',
      descriptionPath: 'meta.description',
    }),
  ],
})

/** Same fields as a named tab, for collections that use a tabs layout. */
export const seoTab = (): Tab => ({
  name: 'meta',
  label: 'SEO',
  fields: [
    OverviewField({
      titlePath: 'meta.title',
      descriptionPath: 'meta.description',
      imagePath: 'meta.image',
    }),
    MetaTitleField({ hasGenerateFn: true }),
    MetaImageField({ relationTo: 'media' }),
    MetaDescriptionField({}),
    PreviewField({
      hasGenerateFn: true,
      titlePath: 'meta.title',
      descriptionPath: 'meta.description',
    }),
  ],
})
