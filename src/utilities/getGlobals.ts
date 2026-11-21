import type { Config } from 'src/payload-types'

import configPromise from '@payload-config'
import { type DataFromGlobalSlug, getPayload } from 'payload'
import { unstable_cache } from 'next/cache'
import { connection } from 'next/server'

type Global = keyof Config['globals']

async function getGlobal<T extends Global>(slug: T, depth = 0): Promise<DataFromGlobalSlug<T>> {
  const payload = await getPayload({ config: configPromise })

  const global = await payload.findGlobal({
    slug,
    depth,
  })

  return global
}

/**
 * Returns a unstable_cache function mapped with the cache tag for the slug
 */
export const getCachedGlobal =
  <T extends Global>(slug: T, depth = 0) =>
  async () => {
    // Never prerender: the header and footer must not need a database at build time.
    await connection()
    return unstable_cache(async () => getGlobal<T>(slug, depth), [slug, String(depth)], {
      tags: [`global_${slug}`],
    })()
  }
