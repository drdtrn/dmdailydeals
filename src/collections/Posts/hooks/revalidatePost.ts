import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { revalidate } from '../../../lib/revalidate'
import type { Post } from '../../../payload-types'

export const revalidatePost: CollectionAfterChangeHook<Post> = ({ doc, previousDoc, req }) => {
  if (doc._status === 'published') {
    req.payload.logger.info(`Revalidating post at path: /posts/${doc.slug}`)
    revalidate({
      req,
      paths: [`/posts/${doc.slug}`],
      tags: ['posts', `post:${doc.slug}`, 'posts-sitemap', 'sitemap'],
    })
  }

  // If the post was previously published, we need to revalidate the old path
  if (previousDoc?._status === 'published' && doc._status !== 'published') {
    req.payload.logger.info(`Revalidating old post at path: /posts/${previousDoc.slug}`)
    revalidate({
      req,
      paths: [`/posts/${previousDoc.slug}`],
      tags: ['posts', `post:${previousDoc.slug}`, 'posts-sitemap', 'sitemap'],
    })
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Post> = ({ doc, req }) => {
  revalidate({
    req,
    paths: [`/posts/${doc?.slug}`],
    tags: ['posts', `post:${doc?.slug}`, 'posts-sitemap', 'sitemap'],
  })
  return doc
}
