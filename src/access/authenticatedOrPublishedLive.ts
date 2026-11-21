import type { Access, Where } from 'payload'

/**
 * Public read for deals: published AND not parked in the `draft` lifecycle status.
 * Expired and sold-out deals stay readable (their pages stay up). Staff see everything.
 */
export const authenticatedOrPublishedLive: Access = ({ req: { user } }) => {
  if (user) return true

  const where: Where = {
    and: [{ _status: { equals: 'published' } }, { status: { not_equals: 'draft' } }],
  }
  return where
}
