import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { revalidate } from '../../../lib/revalidate'
import type { Page } from '../../../payload-types'

const pathFor = (slug?: string | null) => (slug === 'home' ? '/' : `/${slug}`)

export const revalidatePage: CollectionAfterChangeHook<Page> = ({ doc, previousDoc, req }) => {
  if (doc._status === 'published') {
    req.payload.logger.info(`Revalidating page at path: ${pathFor(doc.slug)}`)
    revalidate({
      req,
      paths: [pathFor(doc.slug)],
      tags: [`page:${doc.slug}`, 'pages-sitemap', 'sitemap'],
    })
  }

  // If the page was previously published, we need to revalidate the old path
  if (previousDoc?._status === 'published' && doc._status !== 'published') {
    req.payload.logger.info(`Revalidating old page at path: ${pathFor(previousDoc.slug)}`)
    revalidate({
      req,
      paths: [pathFor(previousDoc.slug)],
      tags: [`page:${previousDoc.slug}`, 'pages-sitemap', 'sitemap'],
    })
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Page> = ({ doc, req }) => {
  revalidate({
    req,
    paths: [pathFor(doc?.slug)],
    tags: [`page:${doc?.slug}`, 'pages-sitemap', 'sitemap'],
  })
  return doc
}
