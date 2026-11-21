import type { Payload } from 'payload'

import { NEWSLETTER_CONSENT_VERSION } from './copy'

const SOURCE_RE = /^[a-z0-9][a-z0-9_.:/-]{0,63}$/i

/** `source` comes from a hidden form field, so it is client-controlled: keep it a short label. */
export function sanitiseSource(value: unknown): string {
  const v = typeof value === 'string' ? value.trim() : ''
  return SOURCE_RE.test(v) ? v : 'unknown'
}

/**
 * Stores one subscriber. `email` must already be normalised and validated.
 *
 * - New address: one `active` row with `source`, `consentAt` and the consent wording version.
 *   `confirmedAt` stays empty (no double opt-in until email delivery exists).
 * - Existing active address: a no-op (and the caller still shows success, so the form never
 *   reveals who is on the list).
 * - Existing unsubscribed address: re-activated with fresh consent.
 *
 * PRIVACY: nothing about the requester (IP, user agent) is passed in or stored.
 */
export async function subscribe(
  payload: Payload,
  { email, source, now = new Date() }: { email: string; source?: unknown; now?: Date },
): Promise<'created' | 'exists' | 'reactivated'> {
  const find = () =>
    payload.find({
      collection: 'subscribers',
      where: { email: { equals: email } },
      limit: 1,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })

  const existing = (await find()).docs[0]
  if (existing) return reactivateIfNeeded(payload, existing, now)

  try {
    await payload.create({
      collection: 'subscribers',
      data: {
        email,
        status: 'active',
        source: sanitiseSource(source),
        consentAt: now.toISOString(),
        consentText: NEWSLETTER_CONSENT_VERSION,
      },
      overrideAccess: true,
    })
    return 'created'
  } catch (err) {
    // Two simultaneous signups for the same address: the unique index rejects the second one.
    const raced = (await find()).docs[0]
    if (raced) return 'exists'
    throw err
  }
}

async function reactivateIfNeeded(
  payload: Payload,
  existing: { id: number | string; status: 'active' | 'unsubscribed' },
  now: Date,
): Promise<'exists' | 'reactivated'> {
  if (existing.status === 'active') return 'exists'
  await payload.update({
    collection: 'subscribers',
    id: existing.id,
    data: {
      status: 'active',
      consentAt: now.toISOString(),
      consentText: NEWSLETTER_CONSENT_VERSION,
      confirmedAt: null,
    },
    overrideAccess: true,
  })
  return 'reactivated'
}
