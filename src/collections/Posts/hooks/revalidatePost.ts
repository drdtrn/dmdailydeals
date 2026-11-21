import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { revalidate } from '../../../lib/revalidate'
import type { Post } from '../../../payload-types'

/**
 * Cache tags for a post change. `posts` is on every read that lists posts: the blog index, the
 * home page's "From the blog" and each category hub's "Latest guides", so one tag keeps all of
 * them fresh. `post:<slug>` is the post page itself.
 */
const postTags = (slug: string | null | undefined) => [
  'posts',
  `post:${slug}`,
  'posts-sitemap',
  'sitemap',
]

export const revalidatePost: CollectionAfterChangeHook<Post> = ({ doc, previousDoc, req }) => {
  if (doc._status === 'published') {
    req.payload.logger.info(`Revalidating post at path: /blog/${doc.slug}`)
    revalidate({ req, paths: [`/blog/${doc.slug}`], tags: postTags(doc.slug) })
    // The old URL, when the slug changed while published.
    if (previousDoc?.slug && previousDoc.slug !== doc.slug) {
      revalidate({ req, paths: [`/blog/${previousDoc.slug}`], tags: postTags(previousDoc.slug) })
    }
  }

  // If the post was previously published, we need to revalidate the old path
  if (previousDoc?._status === 'published' && doc._status !== 'published') {
    req.payload.logger.info(`Revalidating old post at path: /blog/${previousDoc.slug}`)
    revalidate({ req, paths: [`/blog/${previousDoc.slug}`], tags: postTags(previousDoc.slug) })
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Post> = ({ doc, req }) => {
  revalidate({ req, paths: [`/blog/${doc?.slug}`], tags: postTags(doc?.slug) })
  return doc
}
