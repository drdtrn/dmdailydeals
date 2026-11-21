import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { handleSubscribe } from '@/lib/newsletter/handler'
import { createRateLimiter, SUBSCRIBE_RATE_LIMIT } from '@/lib/newsletter/rateLimit'
import { siteOrigin } from '@/lib/seo/site'

// Per-request, never cached. A static route segment wins over Payload's `/api/[...slug]` catch-all.
export const dynamic = 'force-dynamic'

const limiter = createRateLimiter(SUBSCRIBE_RATE_LIMIT)

export async function POST(request: Request): Promise<Response> {
  const allowedOrigins = [siteOrigin(), new URL(request.url).origin]
  const host = request.headers.get('host')
  if (host) allowedOrigins.push(`${new URL(request.url).protocol}//${host}`)
  return handleSubscribe(request, {
    payload: await getPayload({ config: configPromise }),
    limiter,
    allowedOrigins,
  })
}
