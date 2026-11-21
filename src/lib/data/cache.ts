import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { connection } from 'next/server'
import { getPayload, type Payload } from 'payload'

/**
 * Every public Payload read goes through `readCached`. Two rules make that safe:
 *
 * 1. `await connection()` runs first, so the page is never prerendered at build time. That is what
 *    lets `pnpm build` run with no database, and keeps countdown targets and live/expired state
 *    current. Nothing here calls `getPayload` until a real request arrives.
 * 2. The Payload call itself sits inside `unstable_cache`, tagged with tags the collection hooks
 *    actually emit (see `src/lib/revalidate.ts` and each collection's hooks), so an edit in the
 *    admin invalidates exactly what it changes and the next request reads fresh data.
 *
 * Callers pass `keyParts` that include every variable the read depends on (slug, page, ids...).
 * Access control is still applied inside the read: use `overrideAccess: false`.
 */
export async function readCached<T>(
  keyParts: (string | number)[],
  tags: string[],
  read: (payload: Payload) => Promise<T>,
  revalidate?: number,
): Promise<T> {
  await connection()
  return unstable_cache(
    async () => read(await getPayload({ config: configPromise })),
    keyParts.map(String),
    { tags, ...(revalidate ? { revalidate } : {}) },
  )()
}

/** Slugs from the URL are used in cache keys and tags: reject anything that can't be a real slug. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export function isSlug(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.length <= 120 && SLUG_RE.test(value)
}
