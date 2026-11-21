import type { PayloadRequest } from 'payload'

import type { Media } from '@/payload-types'

/** The only author data public pages may use. No email, no auth fields. */
export type PublicAuthor = {
  id: number | string
  displayName: string
  bio: string | null
  avatar: Media | null
  sameAs: string[]
}

/**
 * Reads the public fields of a user (`select` keeps everything else out of memory) and returns
 * null when the person has no display name: a byline needs a real, chosen name, so a user without
 * one is simply not shown as an author.
 */
export async function getPublicAuthor(
  req: Pick<PayloadRequest, 'payload' | 'context'>,
  id: number | string,
): Promise<PublicAuthor | null> {
  const cache = ((req.context as Record<string, unknown>).publicAuthors ??= {}) as Record<
    string,
    PublicAuthor | null
  >
  const key = String(id)
  if (key in cache) return cache[key]

  const user = await req.payload.findByID({
    collection: 'users',
    id,
    depth: 1,
    overrideAccess: true,
    select: { displayName: true, bio: true, avatar: true, sameAs: true },
  })
  const displayName = user.displayName?.trim()
  cache[key] = displayName
    ? {
        id: user.id,
        displayName,
        bio: user.bio?.trim() || null,
        avatar: typeof user.avatar === 'object' && user.avatar ? user.avatar : null,
        sameAs: (user.sameAs ?? []).map((s) => s.url).filter(Boolean),
      }
    : null
  return cache[key]
}

/** The public author attached to a post by the `populateAuthor` hook, checked at runtime. */
export function authorOfPost(post: { populatedAuthor?: unknown }): PublicAuthor | null {
  const a = post.populatedAuthor as Partial<PublicAuthor> | null | undefined
  if (!a || typeof a !== 'object' || typeof a.displayName !== 'string' || !a.displayName)
    return null
  return {
    id: a.id as number | string,
    displayName: a.displayName,
    bio: a.bio ?? null,
    avatar: a.avatar ?? null,
    sameAs: Array.isArray(a.sameAs)
      ? a.sameAs.filter((u): u is string => typeof u === 'string')
      : [],
  }
}
