import config from '@payload-config'
import { getPayload } from 'payload'
import { after, type NextRequest, NextResponse } from 'next/server'

import { countryFromHeader, sameOriginPath, utmFromSearchParams } from '@/lib/go/click'
import { isBotUserAgent } from '@/lib/go/isBot'
import { logClick } from '@/lib/go/logClick'
import { buildOutboundUrl, plainOutboundUrl } from '@/lib/go/outboundUrl'
import { relId } from '@/lib/relId'
import { getServerSideURL } from '@/utilities/getURL'

/**
 * Outbound redirect: `/go/<deal id>` -> the store, through the store's link template.
 *
 * - 404 (a real status, not a redirect) for unknown ids and for deals the public can't see
 *   (unpublished, or lifecycle status `draft`). Expired and sold-out deals still redirect.
 * - 302 with `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow`.
 * - NEVER set `Referrer-Policy: no-referrer`: Amazon's anti-cloaking rule needs the referring
 *   site to be visible to the store.
 * - The click is logged in `after()`; logging failures never affect the redirect.
 */
export const dynamic = 'force-dynamic'

const baseHeaders = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
}

const notFound = () => new NextResponse('Not found', { status: 404, headers: baseHeaders })

export async function GET(request: NextRequest, ctx: RouteContext<'/go/[id]'>) {
  const { id } = await ctx.params
  if (!/^\d{1,18}$/.test(id)) return notFound()

  const payload = await getPayload({ config })

  // Access-controlled read: anonymous callers only get published, non-`draft` deals.
  const deal = await payload
    .findByID({ collection: 'deals', id: Number(id), depth: 0, overrideAccess: false })
    .catch(() => null)
  if (!deal) return notFound()

  const storeId = relId(deal.store)
  if (storeId === undefined) return notFound()
  // The affiliate fields are staff-only, so read the store server-side with full access.
  const store = await payload
    .findByID({ collection: 'stores', id: storeId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!store) return notFound()

  let target = buildOutboundUrl(deal.productUrl, store)
  if (!target) {
    // A broken link template must not lose the click: fall back to the plain product URL.
    target = plainOutboundUrl(deal.productUrl)
    if (target) {
      payload.logger.error(`/go/${id}: store ${store.id} has an unusable link template`)
    }
  }
  if (!target) return notFound()

  const headers = request.headers
  const click = {
    dealId: deal.id,
    storeId: store.id,
    fromPath: sameOriginPath(headers.get('referer'), [
      getServerSideURL(),
      request.nextUrl.origin,
      headers.get('host') ? `${request.nextUrl.protocol}//${headers.get('host')}` : null,
    ]),
    utm: utmFromSearchParams(request.nextUrl.searchParams),
    country: countryFromHeader(headers.get('cf-ipcountry')),
    isBot: isBotUserAgent(headers.get('user-agent')),
  }
  after(() => logClick(payload, click))

  const response = NextResponse.redirect(target, 302)
  for (const [name, value] of Object.entries(baseHeaders)) response.headers.set(name, value)
  return response
}
