import type { Metadata } from 'next'

import type { Page, Post } from '../payload-types'

import { pageMetadata } from '@/lib/seo/meta'

/** Metadata for a CMS document (page or blog post) from its SEO tab. */
export const generateMeta = async (args: {
  doc: Partial<Page> | Partial<Post> | null
  /** Canonical path of the document. */
  path: string
}): Promise<Metadata> => {
  const { doc, path } = args
  return pageMetadata({
    title: (doc?.meta?.title || doc?.title || 'DMDailyDeals').replace(
      /\s*[|·]\s*DMDailyDeals$/,
      '',
    ),
    description: doc?.meta?.description,
    image: doc?.meta?.image,
    path,
  })
}
