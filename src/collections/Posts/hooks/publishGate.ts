import type { CollectionBeforeChangeHook } from 'payload'

import { APIError } from 'payload'

import type { Post } from '../../../payload-types'

export const PUBLISH_GATE_MESSAGE =
  'This post is marked AI-assisted and has not been reviewed. Set "Reviewed by" to the person who read it before publishing.'

/**
 * Decision D8: a human review is required before an AI-assisted post can be published.
 *
 * It runs in `beforeChange`, so every path that saves a post goes through it: the admin Publish
 * button, the REST and Local APIs, and the scheduled-publish job (which calls `payload.update`
 * with `_status: 'published'`). The check looks at the values the save would produce: a field that
 * is not in `data` keeps its stored value.
 *
 * It also keeps `reviewedAt` consistent: defaulted to now when a reviewer is set, cleared when the
 * reviewer is removed.
 */
export const publishGate: CollectionBeforeChangeHook<Post> = ({ data, originalDoc }) => {
  const next = { ...originalDoc, ...data } as Partial<Post>

  const reviewedBy = next.reviewedBy ?? null
  if (reviewedBy) {
    if (!next.reviewedAt) data.reviewedAt = new Date().toISOString()
  } else if (next.reviewedAt) {
    data.reviewedAt = null
  }

  if (next._status === 'published' && next.aiAssisted && !reviewedBy) {
    throw new APIError(PUBLISH_GATE_MESSAGE, 400, undefined, true)
  }
  return data
}
