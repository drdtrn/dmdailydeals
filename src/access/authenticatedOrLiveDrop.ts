import type { Access } from 'payload'

/** Public read for drops: live or archived only. Scheduled drops stay private until they go live. */
export const authenticatedOrLiveDrop: Access = ({ req: { user } }) => {
  if (user) return true

  return { status: { in: ['live', 'archived'] } }
}
