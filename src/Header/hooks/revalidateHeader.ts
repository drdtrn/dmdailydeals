import type { GlobalAfterChangeHook } from 'payload'

import { revalidate } from '../../lib/revalidate'

export const revalidateHeader: GlobalAfterChangeHook = ({ doc, req }) => {
  req.payload.logger.info(`Revalidating header`)
  revalidate({ req, tags: ['global_header'] })
  return doc
}
