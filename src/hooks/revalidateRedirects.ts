import type { CollectionAfterChangeHook } from 'payload'

import { revalidate } from '../lib/revalidate'

export const revalidateRedirects: CollectionAfterChangeHook = ({ doc, req }) => {
  req.payload.logger.info(`Revalidating redirects`)
  revalidate({ req, tags: ['redirects'] })
  return doc
}
