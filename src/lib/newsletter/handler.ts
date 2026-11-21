import type { Payload } from 'payload'

import {
  NEWSLETTER_ERROR,
  NEWSLETTER_INVALID_EMAIL,
  SUBSCRIBED_PARAM,
  SUBSCRIBED_VALUES,
  type SubscribedFlag,
} from './copy'
import { isValidEmail, normaliseEmail } from './email'
import { clientIp, type RateLimiter } from './rateLimit'
import { subscribe } from './subscribe'

const MAX_BODY_BYTES = 8 * 1024
const NO_STORE = 'no-store'

export type SubscribeDeps = {
  payload: Payload
  limiter: RateLimiter
  /** Origins a form post may be redirected back to (the public site URL). */
  allowedOrigins: string[]
}

type Body = { email?: unknown; source?: unknown; website?: unknown }

function json(
  body: { ok: true } | { ok: false; error: string },
  status: number,
  extra?: HeadersInit,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': NO_STORE, ...extra },
  })
}

/**
 * Where a no-JS form post goes back to: the referring page's path when it is on our own origin,
 * otherwise `/`. A relative `Location` is used on purpose, so it is right behind any proxy and
 * can never point off-site. Existing `subscribed` params are replaced.
 */
export function returnLocation(
  referer: string | null,
  allowedOrigins: string[],
  flag: SubscribedFlag,
): string {
  let path = '/'
  let search = ''
  if (referer) {
    try {
      const url = new URL(referer)
      if (allowedOrigins.includes(url.origin)) {
        path = url.pathname || '/'
        const params = new URLSearchParams(url.search)
        params.delete(SUBSCRIBED_PARAM)
        search = params.toString() ? `?${params.toString()}` : ''
      }
    } catch {
      // Unparseable referer: fall back to the home page.
    }
  }
  const joiner = search ? '&' : '?'
  return `${path}${search}${joiner}${SUBSCRIBED_PARAM}=${SUBSCRIBED_VALUES[flag]}#newsletter`
}

async function readBody(
  request: Request,
): Promise<{ kind: 'json' | 'form'; body: Body } | Response> {
  const type = (request.headers.get('content-type') ?? '').toLowerCase()
  const kind = type.includes('application/json')
    ? 'json'
    : type.includes('application/x-www-form-urlencoded')
      ? 'form'
      : null
  if (!kind) return json({ ok: false, error: 'Unsupported content type.' }, 415)

  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) return json({ ok: false, error: 'Request too large.' }, 413)
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) return json({ ok: false, error: 'Request too large.' }, 413)

  try {
    if (kind === 'json') {
      const parsed: unknown = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape')
      return { kind, body: parsed as Body }
    }
    return { kind, body: Object.fromEntries(new URLSearchParams(text)) as Body }
  } catch {
    return json({ ok: false, error: 'Malformed request.' }, 400)
  }
}

/**
 * POST /api/subscribe. Accepts JSON (the JS form) or a form-encoded body (the no-JS fallback).
 * JSON requests get JSON answers; form posts always get a 303 back to the page they came from.
 */
export async function handleSubscribe(request: Request, deps: SubscribeDeps): Promise<Response> {
  const parsed = await readBody(request)
  if (parsed instanceof Response) return parsed
  const { kind, body } = parsed

  const reply = (flag: SubscribedFlag, status: number, error?: string, extra?: HeadersInit) =>
    kind === 'json'
      ? flag === 'success'
        ? json({ ok: true }, 200)
        : json({ ok: false, error: error ?? NEWSLETTER_ERROR }, status, extra)
      : new Response(null, {
          status: 303,
          headers: {
            Location: returnLocation(request.headers.get('referer'), deps.allowedOrigins, flag),
            'Cache-Control': NO_STORE,
          },
        })

  // Honeypot: a person never sees this field. Pretend it worked and store nothing.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return reply('success', 200)
  }

  // The IP is only a key into the in-memory limiter. Never stored, never logged.
  const ip = clientIp(request.headers)
  if (ip && !deps.limiter.hit(ip)) {
    return reply('error', 429, 'Too many attempts. Please try again in a few minutes.', {
      'Retry-After': '600',
    })
  }

  const email = normaliseEmail(body.email)
  if (!isValidEmail(email)) return reply('invalid', 400, NEWSLETTER_INVALID_EMAIL)

  try {
    await subscribe(deps.payload, { email, source: body.source })
  } catch (err) {
    // Log the error object only: it carries no request data.
    deps.payload.logger.error({ err, msg: 'subscribe: could not store subscriber' })
    return reply('error', 500)
  }
  return reply('success', 200)
}
