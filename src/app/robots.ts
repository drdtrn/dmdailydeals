import type { MetadataRoute } from 'next'

import {
  ALLOWED_PATHS,
  DISALLOWED_PATHS,
  SEARCH_CRAWLERS,
  TRAINING_CRAWLERS,
  USER_FETCH_CRAWLERS,
} from '@/lib/seo/crawlers'
import { absoluteUrl } from '@/lib/seo/site'

/**
 * Every named crawler is allowed (decision D7 includes training crawlers) and gets the same
 * disallows, because a crawler with its own group ignores the `*` group. The `Allow` lines come
 * first for parsers that stop at the first match; Google uses the most specific (longest) match.
 */
export default function robots(): MetadataRoute.Robots {
  const named = [...SEARCH_CRAWLERS, ...USER_FETCH_CRAWLERS, ...TRAINING_CRAWLERS]
  const rule = { allow: [...ALLOWED_PATHS], disallow: [...DISALLOWED_PATHS] }
  return {
    rules: [
      { userAgent: named, ...rule },
      { userAgent: '*', ...rule },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
