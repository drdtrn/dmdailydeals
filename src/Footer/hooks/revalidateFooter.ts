import type { GlobalAfterChangeHook } from 'payload'

import { revalidate } from '../../lib/revalidate'

export const revalidateFooter: GlobalAfterChangeHook = ({ doc, req }) => {
  req.payload.logger.info(`Revalidating footer`)
  revalidate({ req, tags: ['global_footer'] })
  return doc
}
