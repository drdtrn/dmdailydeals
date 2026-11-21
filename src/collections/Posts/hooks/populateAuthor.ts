import type { CollectionAfterReadHook } from 'payload'

import { getPublicAuthor } from '../../../lib/authors'

/**
 * `users` is staff-only, so a populated `author` would be an id for the public. This hook fills the
 * virtual `populatedAuthor` field with the PUBLIC author fields only (display name, bio, avatar,
 * profile links), read through `getPublicAuthor`. Emails and auth data are never selected.
 */
export const populateAuthor: CollectionAfterReadHook = async ({ doc, req }) => {
  const author = doc?.author
  const id = typeof author === 'object' && author !== null ? author.id : author
  if (id === undefined || id === null) return doc
  try {
    doc.populatedAuthor = await getPublicAuthor(req, id)
  } catch {
    // A missing author must not break reading the post.
  }
  return doc
}
